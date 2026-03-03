import React, { useState, useEffect, useCallback } from 'react';

// Generate correlated data based on causal structure
const generateData = (type, params, n = 50) => {
  const data = [];
  const { strength = 0.7, noise = 0.3 } = params;
  
  for (let i = 0; i < n; i++) {
    let a, b, c, m;
    const rand = () => (Math.random() - 0.5) * 2;
    
    switch(type) {
      case 'direct':
        a = rand() * 50 + 50;
        b = a * strength + rand() * noise * 50 + (1 - strength) * 50;
        break;
      case 'reverse':
        b = rand() * 50 + 50;
        a = b * strength + rand() * noise * 50 + (1 - strength) * 50;
        break;
      case 'confound':
        c = rand() * 50 + 50;
        a = c * strength + rand() * noise * 30;
        b = c * strength + rand() * noise * 30;
        break;
      case 'coincidence':
        a = rand() * 50 + 50;
        b = rand() * 50 + 50;
        break;
      case 'bidirectional':
        a = rand() * 50 + 50;
        b = a * strength * 0.5 + rand() * noise * 30 + 25;
        a = a * 0.5 + b * strength * 0.5 + rand() * noise * 10;
        break;
      case 'mediated':
        a = rand() * 50 + 50;
        m = a * strength + rand() * noise * 20;
        b = m * strength + rand() * noise * 20;
        break;
      case 'collider':
        a = rand() * 50 + 50;
        b = rand() * 50 + 50;
        c = a + b;
        // Only include if c is above threshold (selection bias)
        if (c < params.threshold) {
          i--;
          continue;
        }
        break;
      default:
        a = rand() * 50 + 50;
        b = rand() * 50 + 50;
    }
    
    data.push({ 
      a: Math.max(0, Math.min(100, a)), 
      b: Math.max(0, Math.min(100, b)),
      c: c ? Math.max(0, Math.min(100, c)) : undefined,
      m: m ? Math.max(0, Math.min(100, m)) : undefined
    });
  }
  return data;
};

// Calculate correlation coefficient
const calculateCorrelation = (data) => {
  if (data.length < 2) return 0;
  const n = data.length;
  const sumA = data.reduce((s, d) => s + d.a, 0);
  const sumB = data.reduce((s, d) => s + d.b, 0);
  const sumAB = data.reduce((s, d) => s + d.a * d.b, 0);
  const sumA2 = data.reduce((s, d) => s + d.a * d.a, 0);
  const sumB2 = data.reduce((s, d) => s + d.b * d.b, 0);
  
  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  
  return den === 0 ? 0 : num / den;
};

// Scatter plot component
const ScatterPlot = ({ data, width = 300, height = 250, highlightPoint, onPointHover, xLabel = "Variable A", yLabel = "Variable B", color = "#3b82f6" }) => {
  const padding = 40;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  
  const scaleX = (v) => padding + (v / 100) * plotWidth;
  const scaleY = (v) => height - padding - (v / 100) * plotHeight;
  
  // Calculate regression line
  const n = data.length;
  if (n < 2) return null;
  
  const sumX = data.reduce((s, d) => s + d.a, 0);
  const sumY = data.reduce((s, d) => s + d.b, 0);
  const sumXY = data.reduce((s, d) => s + d.a * d.b, 0);
  const sumX2 = data.reduce((s, d) => s + d.a * d.a, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const lineY = (x) => slope * x + intercept;

  return (
    <svg width={width} height={height} className="bg-gray-50 rounded-lg">
      {/* Grid */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={scaleX(v)} y1={padding} x2={scaleX(v)} y2={height - padding} stroke="#e5e7eb" />
          <line x1={padding} y1={scaleY(v)} x2={width - padding} y2={scaleY(v)} stroke="#e5e7eb" />
          <text x={scaleX(v)} y={height - padding + 15} textAnchor="middle" fontSize="10" fill="#9ca3af">{v}</text>
          <text x={padding - 8} y={scaleY(v) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{v}</text>
        </g>
      ))}
      
      {/* Regression line */}
      <line 
        x1={scaleX(0)} 
        y1={scaleY(lineY(0))} 
        x2={scaleX(100)} 
        y2={scaleY(lineY(100))}
        stroke={color}
        strokeWidth="2"
        strokeDasharray="5,5"
        opacity="0.5"
      />
      
      {/* Points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={scaleX(d.a)}
          cy={scaleY(d.b)}
          r={highlightPoint === i ? 8 : 5}
          fill={color}
          opacity={highlightPoint === i ? 1 : 0.6}
          stroke={highlightPoint === i ? "#1e40af" : "none"}
          strokeWidth="2"
          onMouseEnter={() => onPointHover?.(i)}
          onMouseLeave={() => onPointHover?.(null)}
          className="cursor-pointer transition-all duration-150"
        />
      ))}
      
      {/* Labels */}
      <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="#6b7280" fontWeight="500">{xLabel}</text>
      <text x={12} y={height / 2} textAnchor="middle" fontSize="12" fill="#6b7280" fontWeight="500" transform={`rotate(-90, 12, ${height/2})`}>{yLabel}</text>
    </svg>
  );
};

// Interactive simulation for each type
const DirectCausationSim = () => {
  const [strength, setStrength] = useState(0.7);
  const [noise, setNoise] = useState(0.3);
  const [data, setData] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const regenerate = useCallback(() => {
    setData(generateData('direct', { strength, noise }));
  }, [strength, noise]);

  useEffect(() => { regenerate(); }, [regenerate]);

  const animateGeneration = () => {
    setIsAnimating(true);
    setData([]);
    let i = 0;
    const interval = setInterval(() => {
      setData(prev => [...prev, generateData('direct', { strength, noise }, 1)[0]]);
      i++;
      if (i >= 50) {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 50);
  };

  const correlation = calculateCorrelation(data);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 flex-wrap">
        <ScatterPlot 
          data={data} 
          highlightPoint={hoveredPoint}
          onPointHover={setHoveredPoint}
          xLabel="Cause (A)"
          yLabel="Effect (B)"
          color="#10b981"
        />
        <div className="flex-1 min-w-[200px] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Causal Strength: {(strength * 100).toFixed(0)}%
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-xs text-gray-500 mt-1">How strongly A influences B</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Random Noise: {(noise * 100).toFixed(0)}%
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={noise}
              onChange={(e) => setNoise(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-xs text-gray-500 mt-1">Other factors affecting B</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <div className="text-sm text-gray-600">Correlation (r):</div>
            <div className="text-2xl font-bold text-emerald-600">{correlation.toFixed(3)}</div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={regenerate}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Regenerate
            </button>
            <button 
              onClick={animateGeneration}
              disabled={isAnimating}
              className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50"
            >
              {isAnimating ? "Generating..." : "Animate"}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 bg-gray-100 rounded-lg text-sm">
        <strong>Try this:</strong> Set strength to 100% and noise to 0% — see a perfect correlation! 
        Then increase noise to see how real-world data gets messier while the correlation weakens.
      </div>
    </div>
  );
};

const ConfoundingSim = () => {
  const [showConfound, setShowConfound] = useState(false);
  const [strength, setStrength] = useState(0.8);
  const [data, setData] = useState([]);

  const regenerate = useCallback(() => {
    setData(generateData('confound', { strength, noise: 0.2 }));
  }, [strength]);

  useEffect(() => { regenerate(); }, [regenerate]);

  const correlation = calculateCorrelation(data);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 flex-wrap">
        <div className="relative">
          <ScatterPlot 
            data={data}
            xLabel="Shoe Size (A)"
            yLabel="Reading Level (B)"
            color="#8b5cf6"
          />
          {showConfound && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold shadow-lg animate-bounce">
                AGE causes both!
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[200px] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confound Strength: {(strength * 100).toFixed(0)}%
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>
          <div className="p-3 bg-violet-50 rounded-lg">
            <div className="text-sm text-gray-600">Observed Correlation:</div>
            <div className="text-2xl font-bold text-violet-600">{correlation.toFixed(3)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {showConfound ? "But A doesn't cause B!" : "Looks like A causes B..."}
            </div>
          </div>
          <button 
            onClick={() => setShowConfound(!showConfound)}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
              showConfound 
                ? 'bg-yellow-400 text-yellow-900' 
                : 'bg-violet-500 text-white hover:bg-violet-600'
            }`}
          >
            {showConfound ? "🔍 Confound Revealed!" : "🔍 Reveal the Hidden Cause"}
          </button>
          <button 
            onClick={regenerate}
            className="w-full px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200"
          >
            Regenerate Data
          </button>
        </div>
      </div>
      <div className="p-4 bg-gray-100 rounded-lg text-sm">
        <strong>The Trap:</strong> Kids with bigger feet read better! Should we stretch children's feet? 
        No — <em>age</em> causes both bigger feet AND better reading. This is why controlled experiments matter.
      </div>
    </div>
  );
};

const ColliderSim = () => {
  const [threshold, setThreshold] = useState(100);
  const [data, setData] = useState([]);
  const [allData, setAllData] = useState([]);

  useEffect(() => {
    // Generate all possible data
    const all = [];
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * 100;
      const b = Math.random() * 100;
      all.push({ a, b, c: a + b, selected: false });
    }
    setAllData(all);
  }, []);

  useEffect(() => {
    const filtered = allData.filter(d => d.c >= threshold);
    setData(filtered);
  }, [threshold, allData]);

  const correlationAll = calculateCorrelation(allData);
  const correlationFiltered = calculateCorrelation(data);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 flex-wrap">
        <div className="space-y-2">
          <ScatterPlot 
            data={data}
            xLabel="Talent (A)"
            yLabel="Attractiveness (B)"
            color="#64748b"
          />
          <div className="text-center text-sm text-gray-500">
            Showing: {data.length} / {allData.length} people
          </div>
        </div>
        <div className="flex-1 min-w-[200px] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fame Threshold: {threshold.toFixed(0)}
            </label>
            <input 
              type="range" 
              min="0" 
              max="150" 
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-slate-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Fame = Talent + Attractiveness<br/>
              Only showing people above this fame level
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-xs text-gray-600">All People (r):</div>
              <div className="text-xl font-bold text-green-600">{correlationAll.toFixed(3)}</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-xs text-gray-600">Famous Only (r):</div>
              <div className="text-xl font-bold text-red-600">{correlationFiltered.toFixed(3)}</div>
            </div>
          </div>
          <button 
            onClick={() => {
              const all = [];
              for (let i = 0; i < 200; i++) {
                const a = Math.random() * 100;
                const b = Math.random() * 100;
                all.push({ a, b, c: a + b });
              }
              setAllData(all);
            }}
            className="w-full px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600"
          >
            Regenerate Population
          </button>
        </div>
      </div>
      <div className="p-4 bg-gray-100 rounded-lg text-sm">
        <strong>The Paradox:</strong> Among famous people, talent and attractiveness appear <em>negatively</em> correlated! 
        Move the threshold to 0 to see the truth: they're actually uncorrelated in the general population. 
        Selection creates a false pattern.
      </div>
    </div>
  );
};

const CoincidenceSim = () => {
  const [datasets, setDatasets] = useState([]);
  const [searchCount, setSearchCount] = useState(0);

  const searchForCorrelation = () => {
    const newData = generateData('coincidence', {});
    const r = calculateCorrelation(newData);
    setDatasets(prev => [...prev, { data: newData, r, id: Date.now() }].slice(-10));
    setSearchCount(c => c + 1);
  };

  const searchMany = () => {
    for (let i = 0; i < 20; i++) {
      setTimeout(() => searchForCorrelation(), i * 100);
    }
  };

  const bestCorrelation = datasets.length > 0 
    ? datasets.reduce((best, d) => Math.abs(d.r) > Math.abs(best.r) ? d : best, datasets[0])
    : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-6 flex-wrap">
        <div>
          {bestCorrelation ? (
            <ScatterPlot 
              data={bestCorrelation.data}
              xLabel="Random Variable A"
              yLabel="Random Variable B"
              color="#ef4444"
            />
          ) : (
            <div className="w-[300px] h-[250px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
              Click to search for correlations
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[200px] space-y-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-sm text-gray-600">Searches performed:</div>
            <div className="text-2xl font-bold text-red-600">{searchCount}</div>
          </div>
          {bestCorrelation && (
            <div className="p-3 bg-amber-50 rounded-lg">
              <div className="text-sm text-gray-600">"Best" correlation found:</div>
              <div className="text-2xl font-bold text-amber-600">r = {bestCorrelation.r.toFixed(3)}</div>
              <div className="text-xs text-gray-500">Completely random data!</div>
            </div>
          )}
          <button 
            onClick={searchForCorrelation}
            className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
          >
            🔍 Test Random Variables
          </button>
          <button 
            onClick={searchMany}
            className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            Run 20 Tests (p-hacking!)
          </button>
          <div className="text-xs text-gray-500">
            Recent correlations: {datasets.slice(-5).map(d => d.r.toFixed(2)).join(', ')}
          </div>
        </div>
      </div>
      <div className="p-4 bg-gray-100 rounded-lg text-sm">
        <strong>P-Hacking Demo:</strong> Keep clicking! Eventually you'll find a "significant" correlation (|r| > 0.3) 
        between completely random variables. This is why testing many hypotheses without correction is dangerous.
      </div>
    </div>
  );
};

const BidirectionalSim = () => {
  const [anxietyStart, setAnxietyStart] = useState(50);
  const [insomniaStart, setInsomniaStart] = useState(50);
  const [history, setHistory] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const runSimulation = () => {
    setIsRunning(true);
    setHistory([]);
    let anxiety = anxietyStart;
    let insomnia = insomniaStart;
    const newHistory = [{ anxiety, insomnia, day: 0 }];
    
    for (let day = 1; day <= 30; day++) {
      // Bidirectional effects
      const anxietyEffect = insomnia * 0.3 * (Math.random() * 0.4 + 0.8);
      const insomniaEffect = anxiety * 0.25 * (Math.random() * 0.4 + 0.8);
      
      anxiety = Math.min(100, Math.max(0, anxiety * 0.7 + anxietyEffect + (Math.random() - 0.5) * 10));
      insomnia = Math.min(100, Math.max(0, insomnia * 0.7 + insomniaEffect + (Math.random() - 0.5) * 10));
      
      newHistory.push({ anxiety, insomnia, day });
    }
    
    let i = 0;
    const interval = setInterval(() => {
      setHistory(newHistory.slice(0, i + 1));
      i++;
      if (i >= newHistory.length) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-6 flex-wrap">
        <div className="w-[300px] h-[250px] bg-gray-50 rounded-lg p-4">
          <svg width="100%" height="100%" viewBox="0 0 280 200">
            {/* Grid */}
            {[0, 50, 100].map(v => (
              <g key={v}>
                <line x1={40} y1={180 - v * 1.6} x2={270} y2={180 - v * 1.6} stroke="#e5e7eb" />
                <text x={35} y={184 - v * 1.6} textAnchor="end" fontSize="10" fill="#9ca3af">{v}</text>
              </g>
            ))}
            
            {/* Lines */}
            {history.length > 1 && (
              <>
                <path
                  d={history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${40 + i * 7.5} ${180 - h.anxiety * 1.6}`).join(' ')}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                />
                <path
                  d={history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${40 + i * 7.5} ${180 - h.insomnia * 1.6}`).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
              </>
            )}
            
            {/* Legend */}
            <circle cx={60} cy={15} r={5} fill="#ef4444" />
            <text x={70} y={19} fontSize="11" fill="#374151">Anxiety</text>
            <circle cx={140} cy={15} r={5} fill="#3b82f6" />
            <text x={150} y={19} fontSize="11" fill="#374151">Insomnia</text>
            
            <text x={155} y={198} textAnchor="middle" fontSize="11" fill="#6b7280">Day</text>
          </svg>
        </div>
        <div className="flex-1 min-w-[200px] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starting Anxiety: {anxietyStart}
            </label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={anxietyStart}
              onChange={(e) => setAnxietyStart(parseInt(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starting Insomnia: {insomniaStart}
            </label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={insomniaStart}
              onChange={(e) => setInsomniaStart(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <button 
            onClick={runSimulation}
            disabled={isRunning}
            className="w-full px-4 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 font-medium disabled:opacity-50"
          >
            {isRunning ? "Simulating..." : "▶ Run 30-Day Simulation"}
          </button>
          {history.length > 0 && (
            <div className="p-3 bg-cyan-50 rounded-lg text-sm">
              <div>Day {history.length - 1}</div>
              <div className="flex justify-between">
                <span className="text-red-600">Anxiety: {history[history.length-1]?.anxiety.toFixed(0)}</span>
                <span className="text-blue-600">Insomnia: {history[history.length-1]?.insomnia.toFixed(0)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 bg-gray-100 rounded-lg text-sm">
        <strong>Feedback Loop:</strong> Try starting with high anxiety but low insomnia (or vice versa). 
        Watch how they influence each other over time. Neither is purely the "cause" — they co-evolve!
      </div>
    </div>
  );
};

const ReverseCausationSim = () => {
  const [perspective, setPerspective] = useState('naive');
  const [data, setData] = useState([]);

  useEffect(() => {
    // Fire size is the true cause
    const newData = [];
    for (let i = 0; i < 50; i++) {
      const fireSize = Math.random() * 100;
      const firefighters = fireSize * 0.8 + (Math.random() - 0.5) * 20;
      const damage = fireSize * 0.9 + (Math.random() - 0.5) * 15;
      newData.push({ 
        a: Math.max(0, Math.min(100, firefighters)), 
        b: Math.max(0, Math.min(100, damage)),
        fireSize
      });
    }
    setData(newData);
  }, []);

  const correlation = calculateCorrelation(data);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 flex-wrap">
        <div className="relative">
          <ScatterPlot 
            data={data}
            xLabel="Firefighters"
            yLabel="Damage ($)"
            color="#f59e0b"
          />
        </div>
        <div className="flex-1 min-w-[200px] space-y-4">
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="text-sm text-gray-600">Observed Correlation:</div>
            <div className="text-2xl font-bold text-amber-600">r = {correlation.toFixed(3)}</div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Your interpretation:</div>
            <button 
              onClick={() => setPerspective('naive')}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                perspective === 'naive' 
                  ? 'bg-red-100 border-2 border-red-400' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="font-medium">❌ Firefighters cause damage</div>
              <div className="text-xs text-gray-500">We should send fewer firefighters!</div>
            </button>
            <button 
              onClick={() => setPerspective('correct')}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                perspective === 'correct' 
                  ? 'bg-green-100 border-2 border-green-400' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="font-medium">✓ Fire size causes both</div>
              <div className="text-xs text-gray-500">Bigger fires need more firefighters AND cause more damage</div>
            </button>
          </div>

          <button 
            onClick={() => {
              const newData = [];
              for (let i = 0; i < 50; i++) {
                const fireSize = Math.random() * 100;
                const firefighters = fireSize * 0.8 + (Math.random() - 0.5) * 20;
                const damage = fireSize * 0.9 + (Math.random() - 0.5) * 15;
                newData.push({ 
                  a: Math.max(0, Math.min(100, firefighters)), 
                  b: Math.max(0, Math.min(100, damage)),
                  fireSize
                });
              }
              setData(newData);
            }}
            className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Generate New Fires
          </button>
        </div>
      </div>
      
      {perspective === 'correct' && (
        <div className="p-4 bg-green-100 rounded-lg text-sm border border-green-300">
          <strong>✓ Correct!</strong> This is a classic example of reverse causation / confounding. 
          The true causal structure is: <code className="bg-white px-1 rounded">Fire Size → Firefighters</code> and <code className="bg-white px-1 rounded">Fire Size → Damage</code>.
          Firefighters don't cause damage — they're both effects of the same cause!
        </div>
      )}
      
      {perspective === 'naive' && (
        <div className="p-4 bg-red-100 rounded-lg text-sm border border-red-300">
          <strong>Think again!</strong> If we sent zero firefighters, would there be zero damage? 
          The positive correlation doesn't mean firefighters cause damage. What's the hidden variable?
        </div>
      )}
    </div>
  );
};

// Main component with tabs
const correlationTypes = [
  { id: 'direct', title: 'Direct Causation', subtitle: 'A → B', color: '#10b981', component: DirectCausationSim },
  { id: 'reverse', title: 'Reverse Causation', subtitle: 'Hidden cause', color: '#f59e0b', component: ReverseCausationSim },
  { id: 'confound', title: 'Confounding', subtitle: 'C → A, C → B', color: '#8b5cf6', component: ConfoundingSim },
  { id: 'coincidence', title: 'Coincidence', subtitle: 'Random chance', color: '#ef4444', component: CoincidenceSim },
  { id: 'bidirectional', title: 'Feedback Loop', subtitle: 'A ⇄ B', color: '#06b6d4', component: BidirectionalSim },
  { id: 'collider', title: 'Collider Bias', subtitle: 'Selection effect', color: '#64748b', component: ColliderSim },
];

export default function CorrelationExplorer() {
  const [activeTab, setActiveTab] = useState(correlationTypes[0]);
  const ActiveComponent = activeTab.component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Correlation ≠ Causation
          </h1>
          <p className="text-slate-400 text-lg">
            Interactive simulations showing why correlated variables don't always mean causation
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {correlationTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab.id === type.id
                  ? 'text-white shadow-lg scale-105'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              style={{
                backgroundColor: activeTab.id === type.id ? type.color : undefined
              }}
            >
              <div>{type.title}</div>
              <div className="text-xs opacity-75">{type.subtitle}</div>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div 
            className="p-4 text-white"
            style={{ backgroundColor: activeTab.color }}
          >
            <h2 className="text-xl font-bold">{activeTab.title}</h2>
          </div>
          <div className="p-6">
            <ActiveComponent />
          </div>
        </div>

        {/* Footer tip */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          💡 Tip: Interact with the sliders and buttons to see how different factors affect correlations
        </div>
      </div>
    </div>
  );
}
