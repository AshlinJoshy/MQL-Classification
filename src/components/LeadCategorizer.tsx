"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { GripVertical, Plus, Trash2, RefreshCw, Clipboard, ClipboardCheck } from 'lucide-react';

// --- Types ---
interface Lead {
  id: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_content: string;
  utm_term: string;
  source: string;
  location: string;
  predictedStage: string;
}

interface MappedRule {
  id: string;
  campaign: string;
  filters: Record<string, string>;
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
  [category: string]: MappedRule[];
}

// --- Constants ---
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

const FILTERABLE_COLUMNS = [
  { key: 'utm_source', label: 'UTM Source' },
  { key: 'utm_medium', label: 'UTM Medium' },
  { key: 'utm_content', label: 'UTM Content' },
  { key: 'utm_term', label: 'UTM Term' },
  { key: 'source', label: 'Source' },
  { key: 'location', label: 'Location' },
];

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1fNfgaUQGh8ALzpoUlg35-VJ399bc-Ubc1a-4upYO6Hs/gviz/tq?tqx=out:csv&gid=537993025";


// --- Sub-components ---

function RuleBlock({ 
  rule, 
  categoryName, 
  onUpdate, 
  onRemove, 
  allLeads 
}: { 
  rule: MappedRule, 
  categoryName: string, 
  onUpdate: (r: MappedRule) => void, 
  onRemove: () => void, 
  allLeads: Lead[] 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFilterCol, setNewFilterCol] = useState('');
  const [newFilterVal, setNewFilterVal] = useState('');

  const handleAddFilter = () => {
    if (newFilterCol) {
      onUpdate({
        ...rule,
        filters: {
          ...rule.filters,
          [newFilterCol]: newFilterVal
        }
      });
      setIsAdding(false);
      setNewFilterCol('');
      setNewFilterVal('');
    }
  };

  const availableValues = useMemo(() => {
    if (!newFilterCol) return [];
    const leadsForCampaign = allLeads.filter(l => l.utm_campaign === rule.campaign);
    const vals = new Set(leadsForCampaign.map(l => (l as any)[newFilterCol] || ''));
    return Array.from(vals).sort();
  }, [allLeads, rule.campaign, newFilterCol]);

  return (
    <div 
      className="border border-gray-200 bg-white rounded-md p-2 shadow-sm text-sm cursor-grab active:cursor-grabbing min-w-[200px]"
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'move', ruleId: rule.id, sourceCategory: categoryName }));
        e.dataTransfer.effectAllowed = 'copyMove';
        e.stopPropagation();
      }}
    >
      <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-100">
        <div className="font-semibold text-gray-800 truncate flex items-center gap-1" title={rule.campaign || "(Empty Campaign)"}>
          <GripVertical size={14} className="text-gray-400" />
          <span className="truncate max-w-[200px]">{rule.campaign || "(Empty Campaign)"}</span>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50">
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="space-y-1 mt-2">
        {Object.entries(rule.filters).map(([col, val]) => {
          const colLabel = FILTERABLE_COLUMNS.find(c => c.key === col)?.label || col;
          return (
            <div key={col} className="flex items-center justify-between bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded">
              <span className="truncate max-w-[200px]" title={`${colLabel}: ${val || "(Empty)"}`}>
                <span className="font-medium">{colLabel}:</span> "{val || "(Empty)"}"
              </span>
              <button onClick={() => {
                const newFilters = { ...rule.filters };
                delete newFilters[col];
                onUpdate({ ...rule, filters: newFilters });
              }} className="ml-2 hover:text-red-600 font-bold px-1 rounded hover:bg-blue-100">&times;</button>
            </div>
          );
        })}
      </div>

      {isAdding ? (
        <div className="mt-2 flex flex-col gap-1 bg-gray-50 p-2 rounded border border-gray-200">
          <select 
            className="text-xs p-1.5 border rounded bg-white w-full"
            value={newFilterCol}
            onChange={e => {
              setNewFilterCol(e.target.value);
              setNewFilterVal('');
            }}
          >
            <option value="">Select Field...</option>
            {FILTERABLE_COLUMNS.filter(c => Object.keys(rule.filters).indexOf(c.key) === -1).map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          {newFilterCol && (
            <select 
              className="text-xs p-1.5 border rounded bg-white w-full"
              value={newFilterVal}
              onChange={e => setNewFilterVal(e.target.value)}
            >
              <option value="" disabled>Select Value...</option>
              <option value="">(Empty)</option>
              {availableValues.filter(v => v !== '').map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          <div className="flex gap-1 mt-1">
            <button 
              className="bg-blue-600 text-white text-xs px-2 py-1.5 rounded hover:bg-blue-700 flex-1 disabled:opacity-50"
              disabled={!newFilterCol}
              onClick={handleAddFilter}
            >Add Filter</button>
            <button 
              className="bg-gray-200 text-gray-700 text-xs px-2 py-1.5 rounded hover:bg-gray-300"
              onClick={() => { setIsAdding(false); setNewFilterCol(''); setNewFilterVal(''); }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsAdding(true)}
          className="mt-2 w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-1.5 rounded flex items-center justify-center gap-1 font-medium transition-colors border border-dashed border-blue-200"
        >
          <Plus size={12} /> Add Filter
        </button>
      )}
    </div>
  );
}


// --- Main Component ---

export default function LeadCategorizer() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [mapping, setMapping] = useState<CategoryMapping>(
    DEFAULT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: [] }), {})
  );
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          const seenIds = new Set<string>();
          const parsedLeads: Lead[] = results.data
            .filter((row: any) => row.leadID || row.name || row.utm_campaign)
            .map((row: any, index: number) => {
              // Ensure each lead has a unique ID even if leadID is duplicated or missing
              const rawId = row.leadID ? String(row.leadID).trim() : '';
              let uniqueId = rawId || `row-${index}`;
              if (seenIds.has(uniqueId)) {
                uniqueId = `${uniqueId}_${index}`;
              }
              seenIds.add(uniqueId);
              return {
                id: uniqueId,
                utm_campaign: row['utm_campaign'] || 'Unknown/Empty',
                utm_source: row['utm_source'] || '',
                utm_medium: row['utm_medium'] || '',
                utm_content: row['utm_content'] || '',
                utm_term: row['utm_term'] || '',
                source: row['source'] || '',
                location: row['location'] || '',
                predictedStage: row['Predicted Stage'] || row['stage'] || 'Unknown'
              };
            });
          setLeads(parsedLeads);
          setLoading(false);
        },
        error: (err: any) => {
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

  // Load saved mapping on mount & migrate old schema if needed
  useEffect(() => {
    const savedMapping = localStorage.getItem('mql_mapping');
    const savedCategories = localStorage.getItem('mql_categories');
    
    let parsedCategories = DEFAULT_CATEGORIES;
    if (savedCategories) {
      try {
        parsedCategories = JSON.parse(savedCategories);
        setCategories(parsedCategories);
      } catch (e) {}
    }

    if (savedMapping) {
      try {
        const parsed = JSON.parse(savedMapping);
        const migrated: CategoryMapping = {};
        
        parsedCategories.forEach(cat => {
          if (parsed[cat]) {
            if (Array.isArray(parsed[cat])) {
              migrated[cat] = parsed[cat].map((item: any) => {
                // Migrate old string-based rules to new object-based rules
                if (typeof item === 'string') {
                  return { id: Math.random().toString(36).substring(2, 9), campaign: item, filters: {} };
                }
                return item;
              });
            } else {
              migrated[cat] = [];
            }
          } else {
            migrated[cat] = [];
          }
        });
        setMapping(migrated);
      } catch (e) {
        console.error("Failed to parse local storage mapping", e);
      }
    }
    
    fetchData();
  }, []);

  // Save mapping to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('mql_mapping', JSON.stringify(mapping));
    localStorage.setItem('mql_categories', JSON.stringify(categories));
  }, [mapping, categories]);


  // --- Logic & Derived State ---

  const matchesRule = (lead: Lead, rule: MappedRule) => {
    if (lead.utm_campaign !== rule.campaign) return false;
    for (const [key, value] of Object.entries(rule.filters)) {
      if ((lead as any)[key] !== value) return false;
    }
    return true;
  };

  const leadCategories = useMemo(() => {
    const result = new Map<string, string>(); // lead.id -> categoryName
    
    leads.forEach(lead => {
      // Find first matching category based on rules
      for (const category of categories) {
        const rules = mapping[category] || [];
        if (rules.some(rule => matchesRule(lead, rule))) {
          result.set(lead.id, category);
          break; // First match wins
        }
      }
    });
    return result;
  }, [leads, mapping, categories]);

  const { categorizedLeads, uncategorizedLeads } = useMemo(() => {
    const cat: Lead[] = [];
    const uncat: Lead[] = [];
    leads.forEach(lead => {
      if (leadCategories.has(lead.id)) cat.push(lead);
      else uncat.push(lead);
    });
    return { categorizedLeads: cat, uncategorizedLeads: uncat };
  }, [leads, leadCategories]);

  // Group uncategorized leads by campaign for the left sidebar
  const uncategorizedCampaignGroups = useMemo(() => {
    const groups = new Map<string, number>();
    uncategorizedLeads.forEach(lead => {
      groups.set(lead.utm_campaign, (groups.get(lead.utm_campaign) || 0) + 1);
    });
    // Sort by count descending, then alphabetically
    return Array.from(groups.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  }, [uncategorizedLeads]);

  // Pre-calculate stats for all categories
  const categoryStats = useMemo(() => {
    const stats: Record<string, CampaignStats> = {};
    categories.forEach(c => {
      stats[c] = { total: 0, notQualified: 0, qualified: 0, noAnswer: 0, hotQualified: 0, new: 0, reserved: 0, contacted: 0 };
    });

    categorizedLeads.forEach(lead => {
      const cat = leadCategories.get(lead.id);
      if (cat && stats[cat]) {
        stats[cat].total++;
        const stage = (lead.predictedStage || '').toLowerCase().trim();
        if (stage.includes('not qualified')) stats[cat].notQualified++;
        else if (stage.includes('hot qualified')) stats[cat].hotQualified++;
        else if (stage === 'qualified') stats[cat].qualified++;
        else if (stage.includes('no answer')) stats[cat].noAnswer++;
        else if (stage.includes('new')) stats[cat].new++;
        else if (stage.includes('reserved')) stats[cat].reserved++;
        else if (stage.includes('contacted')) stats[cat].contacted++;
      }
    });
    return stats;
  }, [categories, categorizedLeads, leadCategories]);


  // --- Event Handlers ---

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

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropToCategory = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Use text/plain as it's more universally supported in drag/drop
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      const newMapping = { ...mapping };
      
      if (data.type === 'new') {
        // Create new rule from left sidebar drag
        newMapping[targetCategory] = [
          ...(newMapping[targetCategory] || []),
          { id: Math.random().toString(36).substring(2, 9), campaign: data.campaign, filters: {} }
        ];
      } else if (data.type === 'move') {
        // Move existing rule between categories or within
        if (data.sourceCategory && newMapping[data.sourceCategory]) {
          const ruleToMove = newMapping[data.sourceCategory].find(r => r.id === data.ruleId);
          if (ruleToMove && data.sourceCategory !== targetCategory) {
            newMapping[data.sourceCategory] = newMapping[data.sourceCategory].filter(r => r.id !== data.ruleId);
            newMapping[targetCategory] = [...(newMapping[targetCategory] || []), ruleToMove];
          }
        }
      }
      setMapping(newMapping);
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const updateRule = (categoryName: string, updatedRule: MappedRule) => {
    const newMapping = { ...mapping };
    newMapping[categoryName] = newMapping[categoryName].map(r => r.id === updatedRule.id ? updatedRule : r);
    setMapping(newMapping);
  };

  const removeRule = (categoryName: string, ruleId: string) => {
    const newMapping = { ...mapping };
    newMapping[categoryName] = newMapping[categoryName].filter(r => r.id !== ruleId);
    setMapping(newMapping);
  };

  const [copied, setCopied] = useState(false);

  const handleCopyForSheets = useCallback(() => {
    const columns = [
      'Lead ID', 'Category', 'UTM Campaign', 'UTM Source', 'UTM Medium',
      'UTM Content', 'UTM Term', 'Source', 'Location', 'Predicted Stage'
    ];
    const rows = leads.map(lead => {
      const category = leadCategories.get(lead.id) || 'Uncategorized';
      return [
        lead.id,
        category,
        lead.utm_campaign,
        lead.utm_source,
        lead.utm_medium,
        lead.utm_content,
        lead.utm_term,
        lead.source,
        lead.location,
        lead.predictedStage,
      ].map(v => {
        const s = String(v ?? '');
        // Wrap in quotes if the value contains tabs, newlines or quotes
        if (s.includes('\t') || s.includes('\n') || s.includes('"')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      });
    });
    const tsv = [columns, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [leads, leadCategories]);


  // --- Render ---

  return (
    <div className="flex flex-col gap-6 pb-20">
      
      {/* Overview Banner */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap justify-around items-center gap-4">
        <div className="text-center px-4">
          <p className="text-sm text-gray-500 font-medium">Total Leads</p>
          <p className="text-3xl font-bold text-gray-800">{leads.length}</p>
        </div>
        <div className="hidden md:block w-px h-12 bg-gray-200"></div>
        <div className="text-center px-4">
          <p className="text-sm text-green-600 font-medium">Categorized</p>
          <p className="text-3xl font-bold text-green-700">{categorizedLeads.length}</p>
        </div>
        <div className="hidden md:block w-px h-12 bg-gray-200"></div>
        <div className="text-center px-4">
          <p className="text-sm text-orange-500 font-medium">Pending Categorization</p>
          <p className="text-3xl font-bold text-orange-600">{uncategorizedLeads.length}</p>
        </div>
        <div className="hidden md:block w-px h-12 bg-gray-200"></div>
        <div className="text-center px-4">
          <p className="text-sm text-blue-500 font-medium">Coverage Progress</p>
          <div className="flex flex-col items-center">
            <p className="text-3xl font-bold text-blue-600">
              {leads.length > 0 ? Math.round((categorizedLeads.length / leads.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh Data
          </button>
          <button
            onClick={handleCopyForSheets}
            disabled={leads.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 ${
              copied
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-800 text-white'
            }`}
            title="Copy all leads with their assigned categories as tab-separated values — paste directly into Google Sheets"
          >
            {copied ? <ClipboardCheck size={18} /> : <Clipboard size={18} />}
            {copied ? 'Copied!' : 'Copy for Sheets'}
          </button>
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
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[800px] sticky top-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h2 className="font-semibold text-gray-800 flex justify-between items-center">
              Pending UTMs
              <span className="bg-orange-100 text-orange-800 text-xs font-bold py-1 px-2 rounded-full">
                {uncategorizedCampaignGroups.length} groups
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Drag these to categories. If you apply filters within a category, remaining leads will stay here.
            </p>
          </div>
          
          <div className="p-3 overflow-y-auto flex-1 space-y-2 bg-gray-50/50">
            {uncategorizedCampaignGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-4">
                <span className="text-4xl mb-2">🎉</span>
                <p className="font-medium">100% Categorized!</p>
                <p className="text-xs mt-1">All leads have been mapped to a rule.</p>
              </div>
            ) : (
              uncategorizedCampaignGroups.map(([campaign, count]) => {
                return (
                  <div 
                    key={campaign}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'new', campaign }));
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    className="flex items-center gap-2 bg-white border border-gray-200 p-2.5 rounded cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-sm transition-all group"
                  >
                    <GripVertical size={16} className="text-gray-300 group-hover:text-blue-400" />
                    <span className="text-sm font-medium text-gray-700 truncate flex-1" title={campaign}>
                      {campaign || "(Empty)"}
                    </span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100" title={`${count} pending leads`}>
                      {count}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Area: Category Stats Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-4 font-semibold w-1/4">Category & Rules</th>
                    <th className="px-3 py-4 font-semibold text-center text-blue-800 bg-blue-50/50">Total</th>
                    <th className="px-3 py-4 font-semibold text-center text-red-800 bg-red-50/50">Not Qual</th>
                    <th className="px-3 py-4 font-semibold text-center text-green-800 bg-green-50/50">Qualified</th>
                    <th className="px-3 py-4 font-semibold text-center text-orange-800 bg-orange-50/50">No Answer</th>
                    <th className="px-3 py-4 font-semibold text-center text-emerald-800 bg-emerald-50/50">Hot Qual</th>
                    <th className="px-3 py-4 font-semibold text-center text-purple-800 bg-purple-50/50">New</th>
                    <th className="px-3 py-4 font-semibold text-center text-cyan-800 bg-cyan-50/50">Reserved</th>
                    <th className="px-3 py-4 font-semibold text-center text-indigo-800 bg-indigo-50/50">Contacted</th>
                    <th className="px-4 py-4 font-semibold text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-gray-50/30">
                  {categories.map(category => {
                    const rules = mapping[category] || [];
                    const stats = categoryStats[category] || { total: 0, notQualified: 0, qualified: 0, noAnswer: 0, hotQualified: 0, new: 0, reserved: 0, contacted: 0 };
                    
                    return (
                      <React.Fragment key={category}>
                        {/* Main Category Row */}
                        <tr 
                          className="bg-white group"
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropToCategory(e, category)}
                        >
                          <td 
                            className="px-4 py-4 font-bold text-gray-900 border-r border-gray-100"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base">{category}</span>
                              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                                {rules.length} Rules
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-blue-900 bg-blue-50/30 text-base">{stats.total || '-'}</td>
                          <td className="px-3 py-3 text-center text-red-700 bg-red-50/30 font-medium">{stats.notQualified || '-'}</td>
                          <td className="px-3 py-3 text-center text-green-700 bg-green-50/30 font-medium">{stats.qualified || '-'}</td>
                          <td className="px-3 py-3 text-center text-orange-700 bg-orange-50/30 font-medium">{stats.noAnswer || '-'}</td>
                          <td className="px-3 py-3 text-center text-emerald-700 bg-emerald-50/30 font-medium">{stats.hotQualified || '-'}</td>
                          <td className="px-3 py-3 text-center text-purple-700 bg-purple-50/30 font-medium">{stats.new || '-'}</td>
                          <td className="px-3 py-3 text-center text-cyan-700 bg-cyan-50/30 font-medium">{stats.reserved || '-'}</td>
                          <td className="px-3 py-3 text-center text-indigo-700 bg-indigo-50/30 font-medium">{stats.contacted || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => handleRemoveCategory(category)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50"
                              title="Delete Category"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                        
                        {/* Sub-row showing mapped Rules */}
                        <tr>
                          <td colSpan={10} className="p-0 border-b-4 border-b-gray-100">
                            <div 
                              className="min-h-[80px] p-4 bg-gray-50/50 flex flex-wrap gap-3 items-start"
                              onDragOver={onDragOver}
                              onDrop={(e) => onDropToCategory(e, category)}
                            >
                              {rules.map(rule => (
                                <RuleBlock 
                                  key={rule.id} 
                                  rule={rule} 
                                  categoryName={category}
                                  onUpdate={(r) => updateRule(category, r)}
                                  onRemove={() => removeRule(category, rule.id)}
                                  allLeads={leads}
                                />
                              ))}
                              
                              {rules.length === 0 && (
                                <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-400 text-sm">
                                  Drag and drop pending UTMs here to create rules
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-gray-500 text-lg">
                        No categories found. Create a new category above to get started!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
