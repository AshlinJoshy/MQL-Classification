"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { GripVertical, Plus, Trash2, RefreshCw } from 'lucide-react';

// Types
interface Lead {
  utm_campaign: string;
  predictedStage: string;
}

interface CampaignStats {
  total: number;
  notQualified: number;
  qualified: number;
  noAnswer: number;
  hotQualified: number;
  new: number;
  reserved: number;
  contacted: number;
}

interface CategoryMapping {
  [category: string]: string[];
}

const DEFAULT_CATEGORIES = [
  "Meta - location",
  "Meta - project",
  "Meta - Retargeting",
  "Google",
  "Google Display",
  "Programming",
  "Website",
  "EDM",
  "Untagged",
  "test"
];

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1fNfgaUQGh8ALzpoUlg35-VJ399bc-Ubc1a-4upYO6Hs/gviz/tq?tqx=out:csv&gid=537993025";

export default function LeadCategorizer() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [mapping, setMapping] = useState<CategoryMapping>(
    DEFAULT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: [] }), {})
  );
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draggedCampaign, setDraggedCampaign] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error("Failed to fetch data from Google Sheets");
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedLeads: Lead[] = results.data
            .filter((row: any) => row.leadID || row.name || row.utm_campaign)
            .map((row: any) => ({
              utm_campaign: row['utm_campaign'] || 'Unknown/Empty',
              predictedStage: row['Predicted Stage'] || row['stage'] || 'Unknown'
            }));
          setLeads(parsedLeads);
          setLoading(false);
        },
        error: (err) => {
          console.error(err);
          setError("Failed to parse CSV data");
          setLoading(false);
        }
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error occurred");
      setLoading(false);
    }
  };

  // Load saved mapping on mount
  useEffect(() => {
    const savedMapping = localStorage.getItem('mql_mapping');
    const savedCategories = localStorage.getItem('mql_categories');
    if (savedMapping) setMapping(JSON.parse(savedMapping));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    
    fetchData();
  }, []);

  // Save mapping to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('mql_mapping', JSON.stringify(mapping));
    localStorage.setItem('mql_categories', JSON.stringify(categories));
  }, [mapping, categories]);

  // Derived state
  const allCampaigns = useMemo(() => {
    const unique = new Set(leads.map(l => l.utm_campaign));
    return Array.from(unique).sort();
  }, [leads]);

  const mappedCampaigns = useMemo(() => {
    const mapped = new Set<string>();
    Object.values(mapping).forEach(campaigns => {
      campaigns.forEach(c => mapped.add(c));
    });
    return mapped;
  }, [mapping]);

  const unmappedCampaigns = useMemo(() => {
    return allCampaigns.filter(c => !mappedCampaigns.has(c));
  }, [allCampaigns, mappedCampaigns]);

  const aggregateStats = (campaigns: string[]): CampaignStats => {
    const stats = {
      total: 0,
      notQualified: 0,
      qualified: 0,
      noAnswer: 0,
      hotQualified: 0,
      new: 0,
      reserved: 0,
      contacted: 0,
    };

    const selectedLeads = leads.filter(l => campaigns.includes(l.utm_campaign));
    stats.total = selectedLeads.length;

    selectedLeads.forEach(lead => {
      const stage = (lead.predictedStage || '').toLowerCase().trim();
      if (stage.includes('not qualified')) stats.notQualified++;
      else if (stage.includes('hot qualified')) stats.hotQualified++;
      else if (stage === 'qualified') stats.qualified++;
      else if (stage.includes('no answer')) stats.noAnswer++;
      else if (stage.includes('new')) stats.new++;
      else if (stage.includes('reserved')) stats.reserved++;
      else if (stage.includes('contacted')) stats.contacted++;
    });

    return stats;
  };

  // Handlers
  const handleAddCategory = () => {
    if (!newCategoryName.trim() || categories.includes(newCategoryName.trim())) return;
    const name = newCategoryName.trim();
    setCategories([...categories, name]);
    setMapping({ ...mapping, [name]: [] });
    setNewCategoryName("");
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter(c => c !== catToRemove));
    const newMapping = { ...mapping };
    delete newMapping[catToRemove];
    setMapping(newMapping);
  };

  // Drag & Drop Handlers
  const onDragStart = (e: React.DragEvent, campaign: string) => {
    setDraggedCampaign(campaign);
    e.dataTransfer.setData('text/plain', campaign);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropToCategory = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    const campaign = e.dataTransfer.getData('text/plain');
    if (!campaign) return;

    // Remove from previous category if it existed
    const newMapping = { ...mapping };
    Object.keys(newMapping).forEach(cat => {
      newMapping[cat] = newMapping[cat].filter(c => c !== campaign);
    });

    // Add to new category
    if (!newMapping[targetCategory].includes(campaign)) {
      newMapping[targetCategory] = [...newMapping[targetCategory], campaign];
    }
    
    setMapping(newMapping);
    setDraggedCampaign(null);
  };

  const onDropToUnmapped = (e: React.DragEvent) => {
    e.preventDefault();
    const campaign = e.dataTransfer.getData('text/plain');
    if (!campaign) return;

    // Remove from all categories (sending it back to unmapped)
    const newMapping = { ...mapping };
    Object.keys(newMapping).forEach(cat => {
      newMapping[cat] = newMapping[cat].filter(c => c !== campaign);
    });
    
    setMapping(newMapping);
    setDraggedCampaign(null);
  };

  const handleRemoveCampaignFromCat = (campaign: string, category: string) => {
    const newMapping = { ...mapping };
    newMapping[category] = newMapping[category].filter(c => c !== campaign);
    setMapping(newMapping);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh Data
          </button>
          <span className="text-sm text-gray-500">
            {loading ? "Loading..." : `${leads.length} leads loaded`}
          </span>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="New Category Name" 
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            className="border border-gray-300 rounded-md px-3 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleAddCategory}
            className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-md flex items-center transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-medium">Error fetching data</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar: Unmapped UTM Campaigns */}
        <div 
          className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col max-h-[800px]"
          onDragOver={onDragOver}
          onDrop={onDropToUnmapped}
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h2 className="font-semibold text-gray-800 flex justify-between items-center">
              Uncategorized UTMs
              <span className="bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded-full">
                {unmappedCampaigns.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">Drag these to categories on the right</p>
          </div>
          
          <div className="p-3 overflow-y-auto flex-1 space-y-2">
            {unmappedCampaigns.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">All campaigns categorized!</p>
            ) : (
              unmappedCampaigns.map(campaign => {
                const count = leads.filter(l => l.utm_campaign === campaign).length;
                return (
                  <div 
                    key={campaign}
                    draggable
                    onDragStart={(e) => onDragStart(e, campaign)}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded cursor-grab hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                  >
                    <GripVertical size={16} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 truncate flex-1" title={campaign}>
                      {campaign || "(Empty)"}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Area: Category Stats Table */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Source (Category)</th>
                  <th className="px-3 py-3 font-semibold text-center text-blue-800 bg-blue-50/50">Total</th>
                  <th className="px-3 py-3 font-semibold text-center text-red-800 bg-red-50/50">Not Qual</th>
                  <th className="px-3 py-3 font-semibold text-center text-green-800 bg-green-50/50">Qualified</th>
                  <th className="px-3 py-3 font-semibold text-center text-orange-800 bg-orange-50/50">No Answer</th>
                  <th className="px-3 py-3 font-semibold text-center text-emerald-800 bg-emerald-50/50">Hot Qual</th>
                  <th className="px-3 py-3 font-semibold text-center text-purple-800 bg-purple-50/50">New</th>
                  <th className="px-3 py-3 font-semibold text-center text-cyan-800 bg-cyan-50/50">Reserved</th>
                  <th className="px-3 py-3 font-semibold text-center text-indigo-800 bg-indigo-50/50">Contacted</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map(category => {
                  const campaigns = mapping[category] || [];
                  const stats = aggregateStats(campaigns);
                  
                  return (
                    <React.Fragment key={category}>
                      {/* Main Category Row */}
                      <tr 
                        className="hover:bg-blue-50/30 transition-colors group border-t-2 border-t-gray-100"
                        onDragOver={onDragOver}
                        onDrop={(e) => onDropToCategory(e, category)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-100 min-w-[200px]">
                          <div className="flex items-center justify-between">
                            <span>{category}</span>
                            <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full" title="Drop UTMs here">
                              {campaigns.length} UTMs
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-blue-900 bg-blue-50/30">{stats.total || '-'}</td>
                        <td className="px-3 py-3 text-center text-red-700 bg-red-50/30">{stats.notQualified || '-'}</td>
                        <td className="px-3 py-3 text-center text-green-700 bg-green-50/30">{stats.qualified || '-'}</td>
                        <td className="px-3 py-3 text-center text-orange-700 bg-orange-50/30">{stats.noAnswer || '-'}</td>
                        <td className="px-3 py-3 text-center text-emerald-700 bg-emerald-50/30">{stats.hotQualified || '-'}</td>
                        <td className="px-3 py-3 text-center text-purple-700 bg-purple-50/30">{stats.new || '-'}</td>
                        <td className="px-3 py-3 text-center text-cyan-700 bg-cyan-50/30">{stats.reserved || '-'}</td>
                        <td className="px-3 py-3 text-center text-indigo-700 bg-indigo-50/30">{stats.contacted || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleRemoveCategory(category)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Remove Category"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                      
                      {/* Sub-row showing mapped UTMs */}
                      {campaigns.length > 0 && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={10} className="px-4 py-2 pb-3 border-b border-gray-200">
                            <div className="flex flex-wrap gap-2">
                              {campaigns.map(camp => (
                                <div 
                                  key={camp}
                                  draggable
                                  onDragStart={(e) => onDragStart(e, camp)}
                                  className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded cursor-grab hover:border-blue-400 shadow-sm"
                                >
                                  <GripVertical size={12} className="text-gray-400" />
                                  <span className="max-w-xs truncate" title={camp}>{camp || "(Empty)"}</span>
                                  <button 
                                    onClick={() => handleRemoveCampaignFromCat(camp, category)}
                                    className="ml-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {/* Empty drop zone indicator if no campaigns */}
                      {campaigns.length === 0 && (
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <td colSpan={10} className="px-4 py-2 text-center text-xs text-gray-400 border-dashed border-2 border-transparent">
                            Drag and drop UTM campaigns here
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {categories.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No categories yet. Add one above!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
