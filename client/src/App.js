import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

// --- CONFIGURATION ---
const SOCKET_URL = window.location.hostname === "localhost" 
  ? "http://localhost:3001" 
  : window.location.origin;

const LOGO_URL = "https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg"; 
const socket = io(SOCKET_URL);

// --- UTILITIES ---
const getParams = () => {
  const params = new URLSearchParams(window.location.search);
  return { room: params.get('room'), key: params.get('key') };
};

const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

// --- SOUND SYSTEM ---
const playSound = (type = 'action') => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Calm and soft sounds for different actions
        switch(type) {
            case 'ban':
                oscillator.frequency.value = 220; // Softer lower pitch
                oscillator.type = 'sine'; // Changed from square to sine for softer sound
                gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); // Much lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.15);
                break;
            case 'pick':
                oscillator.frequency.value = 330; // Pleasant higher pitch
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); // Much lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.12);
                break;
            case 'side':
                oscillator.frequency.value = 275; // Mid-range pleasant tone
                oscillator.type = 'sine'; // Changed from triangle to sine
                gainNode.gain.setValueAtTime(0.07, audioContext.currentTime); // Lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'ready':
                oscillator.frequency.value = 440; // Pleasant A note
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.06, audioContext.currentTime); // Lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.08);
                break;
            case 'coin':
                // Soft coin flip sound - two gentle beeps
                [330, 440].forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.frequency.value = freq;
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.06, audioContext.currentTime + i * 0.08); // Lower volume
                    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + i * 0.08 + 0.08); // Softer fade
                    osc.start(audioContext.currentTime + i * 0.08);
                    osc.stop(audioContext.currentTime + i * 0.08 + 0.08);
                });
                return;
            case 'countdown':
                // Soft countdown tick sound
                oscillator.frequency.value = 400; // Pleasant tick tone
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Very soft
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05); // Quick, soft fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.05);
                break;
            default:
                oscillator.frequency.value = 300; // Pleasant mid tone
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.07, audioContext.currentTime); // Lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.12);
        }
    } catch (e) {
        console.warn('Sound playback failed:', e);
    }
};

// --- COUNTDOWN COMPONENT ---
const Countdown = ({ endsAt, soundEnabled = false }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const prevTimeRef = useRef(null);
    
    useEffect(() => {
        if (!endsAt) {
            prevTimeRef.current = null;
            return;
        }
        
        // Initialize on first run
        const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
        const initialDiff = Math.floor((endsAtTime - Date.now()) / 1000);
        const initialTimeLeft = initialDiff > 0 ? initialDiff : 0;
        prevTimeRef.current = initialTimeLeft;
        setTimeLeft(initialTimeLeft);
        
        const interval = setInterval(() => {
            const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
            const diff = Math.floor((endsAtTime - Date.now()) / 1000);
            const newTimeLeft = diff > 0 ? diff : 0;
            
            // Play countdown sound from 10 to 0 (only when time decreases)
            if (soundEnabled && prevTimeRef.current !== null && newTimeLeft <= 10 && newTimeLeft >= 0 && newTimeLeft < prevTimeRef.current) {
                playSound('countdown');
            }
            
            prevTimeRef.current = newTimeLeft;
            setTimeLeft(newTimeLeft);
        }, 1000);
        return () => clearInterval(interval);
    }, [endsAt, soundEnabled]);
    
    if (!endsAt || timeLeft <= 0) return null;
    return <span style={{ color: timeLeft < 10 ? '#ff4444' : '#00d4ff', fontWeight: 'bold', marginLeft: '10px' }}>({timeLeft}s)</span>;
};

// --- ICONS ---
const ExternalLinkIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>);
const CheckIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const CopyIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const HomeIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const UploadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>);
const RefreshIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>);
const UndoIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>);


// --- ANIMATED BACKGROUND ---
const AnimatedBackground = () => (
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:-1,background:'radial-gradient(circle at center, #1b2838 0%, #0b0f19 100%)'}}>
        <div style={{position:'absolute',top:0,left:0,width:'200%',height:'200%',backgroundImage:'linear-gradient(rgba(18,16,16,0) 50%,rgba(0,0,0,0.25) 50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.03))',backgroundSize:'100% 2px, 3px 100%',animation:'scanline 10s linear infinite'}}/>
    </div>
);

const RulesModal = ({ format, onClose }) => {
    const getRules = () => {
        if (format.includes('wingman_bo1')) return ["WINGMAN Bo1:", "1. Team A Bans", "2. Team B Bans", "3. Team A Bans", "4. Team B Bans", "5. Last Map (Knife for Side)"];
        if (format.includes('wingman_bo3')) return ["WINGMAN Bo3:", "1. Team A Bans", "2. Team B Bans", "3. Team A Picks", "4. Team B Side", "5. Team B Picks", "6. Team A Side", "7. Decider Map (Knife for Side)"];
        if (format.includes('faceit_bo1')) return ["FACEIT Bo1:", "1. Team A Bans 1", "2. Team B Bans 1", "3. Team A Bans 1", "4. Team B Bans 1", "5. Team A Bans 1", "6. Team B Bans 1", "7. Remaining Map (Knife for Side)"];
        if (format.includes('faceit_bo3')) return ["FACEIT Bo3:", "1. Team A Bans 1", "2. Team B Bans 1", "3. Team A Picks 1", "4. Team B Picks Side", "5. Team B Picks 1", "6. Team A Picks Side", "7. Team A Bans 1", "8. Team B Bans 1", "9. Decider Map (Knife for Side)"];
        if (format === 'bo1') return ["VRS Bo1:", "1. Team A Bans 2 maps", "2. Team B Bans 3 maps", "3. Team A Bans 1 map", "4. Leftover map is played, and Team B chooses the starting side"];
        if (format === 'bo3') return ["VRS Bo3:", "1. Team A Bans 1st Map", "2. Team B Bans 2nd Map", "3. Team A Picks 3rd Map ; Team B Chooses Side", "4. Team B Picks 4th Map ; Team A Chooses Side", "5. Team B Bans 5th Map", "6. Team A Bans 6th Map", "7. Leftover Map is played as the decider"];
        if (format === 'bo5' || format === 'faceit_bo5') return ["Bo5:", "1. Team A Bans 1st Map", "2. Team B Bans 2nd Map", "3. Team A Picks 3rd map; Team B chooses the starting side", "4. Team B Picks 4th map; Team A chooses the starting side", "5. Team A picks 5th map; Team B chooses the starting side", "6. Team B picks 6th map; Team A chooses the starting side", "7. Left over map is played as decider ; knife round"];
        if (format === 'custom') return ["This is a custom match with custom rules."];
        return [];
    };
    return (
        <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,0.85)',zIndex:2000,display:'flex',justifyContent:'center',alignItems:'center'}}>
            <div style={{background:'#0f1219',border:'2px solid #00d4ff',borderRadius:'15px',padding:'20px',width:'90%',maxWidth:'600px',textAlign:'center'}}>
                <h2 style={{color:'#fff',fontFamily:"'Rajdhani',sans-serif"}}>RULES: {format.toUpperCase().replace('_', ' ')}</h2>
                <div style={{textAlign:'left',background:'rgba(255,255,255,0.05)',padding:'20px',borderRadius:'10px',margin:'20px 0',color:'#ccc'}}>{getRules().map((r,i)=><div key={i}>{r}</div>)}</div>
                <button onClick={onClose} style={{background:'#00d4ff',border:'none',padding:'10px 30px',borderRadius:'5px',fontWeight:'bold',cursor:'pointer'}}>OK</button>
            </div>
        </div>
    );
};

// --- LOG PARSER ---
const LogLineRenderer = ({ log, teamA, teamB }) => {
    const splitIndex = log.indexOf('(');
    let mainPart = log;
    let sidePart = "";

    if (splitIndex !== -1) {
        mainPart = log.substring(0, splitIndex).trim();
        sidePart = log.substring(splitIndex).trim(); 
    }

    const renderWord = (word, i) => {
        let style = { color: '#aaa' };
        if (['banned', 'picked'].includes(word.toLowerCase())) style = { color: '#666' };
        if (word === teamA) style = { color: '#00d4ff', fontWeight: 'bold' };
        if (word === teamB) style = { color: '#ff0055', fontWeight: 'bold' };
        if (word.includes('[BAN]')) style = { color: '#ff4444', fontWeight: 'bold' };
        if (word.includes('[PICK]')) style = { color: '#00ff00', fontWeight: 'bold' };
        return <span key={i} style={style}>{word} </span>;
    };

    return (
        <div style={{ marginBottom: '6px', fontFamily: "'Consolas', monospace", fontSize: '0.9rem', lineHeight:'1.5' }}>
            {mainPart.split(' ').map((w, i) => renderWord(w, i))}
            {sidePart && (
                <span style={{ color: '#00ff00', fontWeight: 'bold', marginLeft:'5px' }}>
                    {sidePart}
                </span>
            )}
        </div>
    );
};

// --- COIN FLIP COMPONENT (FIXED VISUALS) ---
const CoinFlipOverlay = ({ gameState, myRole, onCall, onDecide }) => {
    const [isFlipping, setIsFlipping] = useState(false);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        if (gameState.coinFlip.result && gameState.coinFlip.status === 'deciding') {
            setIsFlipping(true);
            setTimeout(() => {
                setIsFlipping(false);
                setShowResult(true);
            }, 3000); 
        }
    }, [gameState.coinFlip.result, gameState.coinFlip.status]);

    const isCaller = myRole === 'A';
    const isWinner = myRole === gameState.coinFlip.winner;

    return (
        // FIXED: Flat Slate Blue Background (#1e293b) - Not Black
        <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#1e293b',zIndex:3000,display:'flex',justifyContent:'center',alignItems:'center', flexDirection:'column'}}>
            <style>
                {`
                    @keyframes flip3d {
                        0% { transform: rotateY(0); }
                        100% { transform: rotateY(1800deg); }
                    }
                `}
            </style>
            
            <h1 style={{color:'#ffd700', fontSize:'3rem', marginBottom:'30px', textShadow:'0 0 20px #ffd700', fontFamily:"'Rajdhani', sans-serif"}}>COIN TOSS</h1>
            
            {gameState.coinFlip.status === 'waiting_call' && (
                <div style={{textAlign:'center'}}>
                    <h2 style={{color:'#fff', marginBottom:'20px', fontFamily:"'Rajdhani', sans-serif"}}>{isCaller ? "CALL THE TOSS" : `WAITING FOR ${gameState.teamA}...`}</h2>
                    {isCaller && (
                        <div style={{display:'flex', gap:'20px'}}>
                            <button onClick={() => onCall('heads')} style={{padding:'20px 40px', fontSize:'1.5rem', background:'transparent', border:'2px solid #ffd700', color:'#ffd700', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontFamily:"'Rajdhani', sans-serif"}}>HEADS</button>
                            <button onClick={() => onCall('tails')} style={{padding:'20px 40px', fontSize:'1.5rem', background:'transparent', border:'2px solid #fff', color:'#fff', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontFamily:"'Rajdhani', sans-serif"}}>TAILS</button>
                        </div>
                    )}
                </div>
            )}

            {(isFlipping || showResult) && (
                <div style={{perspective:'1000px', marginBottom:'40px', display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                        width:'150px', height:'150px', borderRadius:'50%', border:'5px solid #fff', 
                        // FIXED: CSS Gradient Coin
                        background: gameState.coinFlip.result === 'heads' ? 'radial-gradient(circle at 30% 30%, #ffd700, #b8860b)' : 'radial-gradient(circle at 30% 30%, #94a3b8, #475569)',
                        boxShadow: gameState.coinFlip.result === 'heads' ? '0 0 50px rgba(255, 215, 0, 0.6)' : '0 0 50px rgba(148, 163, 184, 0.6)',
                        animation: isFlipping ? 'flip3d 3s ease-out forwards' : 'none',
                        marginBottom: '20px',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        fontSize: '4rem', fontWeight: '900', color: '#fff', textShadow: '0 2px 5px rgba(0,0,0,0.5)', fontFamily:"'Rajdhani', sans-serif",
                        transformStyle: 'preserve-3d'
                    }}>
                         {isFlipping ? '?' : (gameState.coinFlip.result === 'heads' ? 'H' : 'T')}
                    </div>
                    
                    {!isFlipping && (
                        // FIXED: Black Bold Text on White
                        <div style={{
                            background: '#fff', color: '#000', padding: '10px 40px', borderRadius: '50px', 
                            fontSize: '2rem', fontWeight: '900', textTransform: 'uppercase',
                            fontFamily: "'Rajdhani', sans-serif", boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
                        }}>
                            {gameState.coinFlip.result}
                        </div>
                    )}
                </div>
            )}

            {showResult && gameState.coinFlip.status === 'deciding' && (
                <div style={{textAlign:'center', animation:'fadeIn 1s'}}>
                    <h2 style={{color:'#00ff00', fontSize:'2rem', marginBottom:'10px', fontFamily:"'Rajdhani', sans-serif"}}>{gameState.coinFlip.winner === 'A' ? gameState.teamA : gameState.teamB} WON!</h2>
                    <h3 style={{color:'#aaa', marginBottom:'20px', fontFamily:"'Rajdhani', sans-serif"}}>{isWinner ? "CHOOSE WHO BANS FIRST" : "WAITING FOR DECISION..."}</h3>
                    {isWinner && (
                        <div style={{display:'flex', gap:'20px', justifyContent:'center'}}>
                             <button onClick={() => onDecide('first')} style={{padding:'15px 30px', background:'#00d4ff', border:'none', color:'#000', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontFamily:"'Rajdhani', sans-serif"}}>WE START</button>
                             <button onClick={() => onDecide('second')} style={{padding:'15px 30px', background:'#ff0055', border:'none', color:'#fff', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontFamily:"'Rajdhani', sans-serif"}}>THEY START</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function App() {
  const [params] = useState(getParams());
  const [gameState, setGameState] = useState(null);
  const [myRole, setMyRole] = useState(null); 
  const [view, setView] = useState('home'); 
  const [historyData, setHistoryData] = useState([]);
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showNotification, setShowNotification] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null); 
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showRules, setShowRules] = useState(false); 
  const rulesShownRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputError, setInputError] = useState(false);

  const isAdminRoute = window.location.pathname === '/admin';
  const [adminSecret, setAdminSecret] = useState(localStorage.getItem('adminSecret') || '');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  const [adminTeamA, setAdminTeamA] = useState('');
  const [adminTeamB, setAdminTeamB] = useState('');
  const [adminLinks, setAdminLinks] = useState(null);
  const [mapPool, setMapPool] = useState([]);
  const [newMapName, setNewMapName] = useState('');
  const [newMapImage, setNewMapImage] = useState('');

  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [teamALogo, setTeamALogo] = useState('');
  const [teamBLogo, setTeamBLogo] = useState('');

  const [createdLinks, setCreatedLinks] = useState(null);
  const [availableMaps, setAvailableMaps] = useState([]); 
  const [customSelectedMaps, setCustomSelectedMaps] = useState([]); 
  const [customSequence, setCustomSequence] = useState([]);
  const [userCustomMap, setUserCustomMap] = useState('');
  const [useTimer, setUseTimer] = useState(false);
  const [timerDuration, setTimerDuration] = useState(60); // Default 60 seconds
  const [useCoinFlip, setUseCoinFlip] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false'); // Default enabled
  
  const prevLogsRef = useRef([]); // Track previous logs to detect new actions 
  
  const [vetoMode, setVetoMode] = useState('vrs');

  const fileInputA = useRef(null);
  const fileInputB = useRef(null);

  const fetchAdminHistory = useCallback((secret) => {
      fetch(`${SOCKET_URL}/api/admin/history`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) })
      .then(res => res.json()).then(data => {
          if (data.error) { if(!isAdminRoute) alert(data.error); } 
          else { setHistoryData(data); setIsAdminAuthenticated(true); localStorage.setItem('adminSecret', secret); }
      });
  }, [isAdminRoute]);

  const fetchMapPool = useCallback((secret) => { 
      fetch(`${SOCKET_URL}/api/admin/maps/get`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) })
      .then(r=>r.json()).then(data => { if(Array.isArray(data)) setMapPool(data); }); 
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    const link = document.createElement('link'); link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap'; link.rel = 'stylesheet'; document.head.appendChild(link);
    document.title = "LOTGaming | CS2 Veto";

    fetch(`${SOCKET_URL}/api/maps`)
        .then(r => {
            if(!r.ok) throw new Error("Server Error");
            return r.json();
        })
        .then(data => {
            setAvailableMaps(data);
            setCustomSelectedMaps(data.map(m=>m.name));
        })
        .catch(e => console.error("Map fetch failed:", e));

    if(isAdminRoute && adminSecret) {
        fetchAdminHistory(adminSecret);
        fetchMapPool(adminSecret);
    }

    if (params.room && !isAdminRoute) {
      socket.emit('join_room', { roomId: params.room, key: params.key });
      socket.on('update_state', (data) => {
          // Detect new actions by comparing logs
          if (data && data.logs && prevLogsRef.current.length > 0 && soundEnabled) {
              const newLogs = data.logs.slice(prevLogsRef.current.length);
              newLogs.forEach(log => {
                  if (log.includes('[BAN]')) playSound('ban');
                  else if (log.includes('[PICK]')) playSound('pick');
                  else if (log.includes('[SIDE]') || (log.includes('chose') && log.includes('side'))) playSound('side');
                  else if (log.includes('[READY]')) playSound('ready');
                  else if (log.includes('[COIN]')) playSound('coin');
                  else if (log.includes('[AUTO-BAN]') || log.includes('[AUTO-PICK]') || log.includes('[AUTO-SIDE]')) {
                      // Play sound for auto actions too
                      if (log.includes('AUTO-BAN')) playSound('ban');
                      else if (log.includes('AUTO-PICK')) playSound('pick');
                      else if (log.includes('AUTO-SIDE')) playSound('side');
                  }
              });
          }
          if (data && data.logs) prevLogsRef.current = [...data.logs];
          setGameState(data);
          if (data && !data.finished && !rulesShownRef.current) { setShowRules(true); rulesShownRef.current = true; }
      });
      socket.on('role_assigned', (role) => setMyRole(role));
    }

    socket.on('match_created', ({ roomId, keys }) => {
      const links = {
          admin: `${window.location.origin}/?room=${roomId}&key=${keys.admin}`,
          teamA: `${window.location.origin}/?room=${roomId}&key=${keys.A}`,
          teamB: `${window.location.origin}/?room=${roomId}&key=${keys.B}`
      };
      
      if(isAdminRoute) {
          setAdminLinks(links);
          fetchAdminHistory(adminSecret);
      } else {
          setTimeout(() => { setIsGenerating(false); setCreatedLinks(links); }, 800);
      }
    });

    return () => { socket.off('update_state'); socket.off('role_assigned'); window.removeEventListener('resize', handleResize); };
  }, [params.room, params.key, isAdminRoute, adminSecret, fetchAdminHistory, fetchMapPool, soundEnabled]); 

  const handleLogoUpload = (e, team) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 2000000) return alert("File too large. Max 2MB.");
          const reader = new FileReader();
          reader.onloadend = () => {
              if(team === 'A') setTeamALogo(reader.result);
              else setTeamBLogo(reader.result);
          };
          reader.readAsDataURL(file);
      }
  };

  const createMatch = (type, isFromAdmin = false) => {
      const tA = isFromAdmin ? adminTeamA : teamA;
      const tB = isFromAdmin ? adminTeamB : teamB;
      const logoA = isFromAdmin ? '' : teamALogo; 
      const logoB = isFromAdmin ? '' : teamBLogo;

      if (!tA.trim() || !tB.trim()) { setInputError(true); return; }
      
      let format = type;
      if (vetoMode === 'faceit') {
          if (type === 'bo1') format = 'faceit_bo1';
          if (type === 'bo3') format = 'faceit_bo3';
          if (type === 'bo5') format = 'faceit_bo5';
      } else if (vetoMode === 'wingman') {
          if (type === 'bo1') format = 'wingman_bo1';
          if (type === 'bo3') format = 'wingman_bo3';
      } else if (vetoMode === 'custom') {
          format = 'custom';
      }

      if (format === 'custom') {
          if (customSelectedMaps.length === 0) return alert("Please select at least one map.");
          if (customSequence.length === 0) return alert("Please define at least one step in the sequence.");
      }
      
      if(!isFromAdmin) setIsGenerating(true); 
      const durationToSend = useTimer ? timerDuration : 60;
      console.log('[CLIENT] Creating match - useTimer:', useTimer, 'timerDuration:', timerDuration, 'sending:', durationToSend);
      socket.emit('create_match', { 
          teamA: tA, teamB: tB,
          teamALogo: logoA, teamBLogo: logoB, 
          format,
          customMapNames: format === 'custom' ? customSelectedMaps : null,
          customSequence: format === 'custom' ? customSequence : null,
          useTimer: useTimer,
          timerDuration: durationToSend,
          useCoinFlip: useCoinFlip
      });
  };
  
  const handleAction = (data) => {
    if (!gameState || gameState.finished) return;
    // Play sound immediately on user action (before server confirms)
    if (soundEnabled) {
      const currentStep = gameState.sequence[gameState.step];
      if (currentStep) {
        if (currentStep.a === 'ban') playSound('ban');
        else if (currentStep.a === 'pick') playSound('pick');
        else if (currentStep.a === 'side') playSound('side');
      }
    }
    socket.emit('action', { roomId: params.room, data, key: params.key });
  };

  const handleReady = () => {
      if (soundEnabled) playSound('ready');
      socket.emit('team_ready', { roomId: params.room, key: params.key });
  };

  // --- COIN HANDLERS ---
  const handleCoinCall = (call) => {
      if (soundEnabled) playSound('coin');
      socket.emit('coin_call', { roomId: params.room, call, key: params.key });
  };

  const handleCoinDecide = (decision) => {
      if (soundEnabled) playSound('coin');
      socket.emit('coin_decision', { roomId: params.room, decision, key: params.key });
  };

  const fetchPublicHistory = (page = 1) => {
      fetch(`${SOCKET_URL}/api/history?page=${page}&limit=10`)
          .then(res => {
              if(!res.ok) throw new Error("Server Error");
              return res.json();
          })
          .then(data => { 
              setHistoryData(data.matches);
              setTotalPages(data.totalPages);
              setCurrentPage(data.currentPage);
              setView('history'); 
          })
          .catch(err => console.error("Error fetching history:", err));
  };

  const handlePageChange = (newPage) => {
      if (newPage > 0 && newPage <= totalPages) {
          fetchPublicHistory(newPage);
      }
  };

  const updateMapPool = (newMaps) => { fetch(`${SOCKET_URL}/api/admin/maps/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret, maps: newMaps }) }).then(r=>r.json()).then(data => { if(data.success) setMapPool(data.maps); }); };
  const handleAddMap = () => { if(!newMapName.trim()) return; const newMap = { name: newMapName.trim(), customImage: newMapImage.trim() || null }; updateMapPool([...mapPool, newMap]); setNewMapName(''); setNewMapImage(''); };
  const handleDeleteMap = (idx) => { if(!window.confirm("Remove map?")) return; const updated = [...mapPool]; updated.splice(idx, 1); updateMapPool(updated); };
  const deleteMatch = (id) => { if(!window.confirm("DELETE?")) return; fetch(`${SOCKET_URL}/api/admin/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, secret: adminSecret }) }).then(res => res.json()).then(data => { if(data.success) fetchAdminHistory(adminSecret); }); };
  const nukeHistory = () => { if(!window.confirm("DELETE ALL?")) return; fetch(`${SOCKET_URL}/api/admin/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret }) }).then(res => res.json()).then(data => { if(data.success) fetchAdminHistory(adminSecret); }); };

  // --- ADMIN ACTIONS ---
  const handleAdminReset = (roomId) => {
      if(!window.confirm("Reset this match completely?")) return;
      socket.emit('admin_reset_match', { roomId, secret: adminSecret });
  };

  const handleAdminUndo = (roomId) => {
      socket.emit('admin_undo_step', { roomId, secret: adminSecret });
  };

  const handleCopyLogs = (text) => { navigator.clipboard.writeText(text).then(() => { setShowNotification(true); setTimeout(() => setShowNotification(false), 3000); }); };
  const copyLink = (roomId, key) => { handleCopyLogs(`${window.location.origin}/?room=${roomId}&key=${key}`); };
  const goHome = () => window.location.href = "/";

  const toggleMapSelection = (mapName) => {
      if(customSelectedMaps.includes(mapName)) setCustomSelectedMaps(customSelectedMaps.filter(m=>m!==mapName));
      else setCustomSelectedMaps([...customSelectedMaps, mapName]);
  };
  
  const addUserMap = () => {
      if(!userCustomMap.trim()) return;
      const newName = userCustomMap.trim();
      setAvailableMaps([...availableMaps, { name: newName }]);
      setCustomSelectedMaps([...customSelectedMaps, newName]);
      setUserCustomMap('');
  };

  const addSequenceStep = (team, action) => setCustomSequence([...customSequence, { t: team, a: action }]);
  const removeSequenceStep = (idx) => { const s = [...customSequence]; s.splice(idx,1); setCustomSequence(s); };

  const getInstruction = () => {
    if (!gameState || gameState.finished) return "VETO COMPLETED, CHECK DISCORD MATCHROOM FOR THE SERVER IP";
    if (!gameState.sequence || !gameState.sequence[gameState.step]) return "VETO COMPLETED";
    const currentStep = gameState.sequence[gameState.step];
    const teamName = currentStep.t === 'A' ? gameState.teamA : gameState.teamB;
    const isMe = currentStep.t === myRole; 
    
    if (gameState.useTimer && gameState.ready) {
        if (!gameState.ready.A || !gameState.ready.B) {
            if (isMe && !gameState.ready[myRole]) return "PLEASE CLICK READY TO START";
            return "WAITING FOR TEAMS TO READY UP";
        }
    }

    if (currentStep.a === 'side') return isMe ? "CHOOSE STARTING SIDE" : `${teamName.toUpperCase()} IS CHOOSING SIDE`;
    let count = 0;
    for (let i = gameState.step; i < gameState.sequence.length; i++) { if (gameState.sequence[i].t === currentStep.t && gameState.sequence[i].a === currentStep.a) count++; else break; }
    const actionText = currentStep.a === 'ban' ? 'BAN' : 'PICK';
    return isMe ? `YOUR TURN: ${actionText} ${count} MAP${count > 1 ? 'S' : ''}` : `WAITING FOR ${teamName.toUpperCase()}`;
  };

  // --- NEW HELPER FOR ROLE BADGE ---
  const getRoleLabel = () => {
      if (myRole === 'admin') return { text: 'ADMIN VIEW', color: '#ffd700' };
      if (myRole === 'A') return { text: `${gameState.teamA} VIEW`, color: '#00d4ff' };
      if (myRole === 'B') return { text: `${gameState.teamB} VIEW`, color: '#ff0055' };
      return { text: 'SPECTATOR VIEW', color: '#888' };
  };

  const getMapLogData = (mapName) => {
      if(!gameState || !gameState.logs) return null;
      const banLog = gameState.logs.find(l => l.includes(`banned ${mapName}`));
      if(banLog) return { type: 'ban', team: banLog.split(' banned ')[0].replace('[BAN] ', '').trim() };
      const pickLog = gameState.logs.find(l => l.includes(`picked ${mapName}`));
      if(pickLog) {
          const teamName = pickLog.split(' picked ')[0].replace('[PICK] ', '').trim();
          const sideLog = gameState.logs.find(l => l.includes(`side for ${mapName}`));
          let sideText = "WAITING FOR SIDE";
          if(sideLog) { 
              const match = sideLog.match(/(?:\[SIDE\]|\() (.*?) chose (.*?) side/); 
              if(match) sideText = `${match[1]} CHOSE ${match[2]}`; 
          }
          return { type: 'pick', team: teamName, sideText };
      }
      if (gameState.logs.find(l => l.includes(`[DECIDER] ${mapName} (Knife`))) return { type: 'decider', sideText: 'SIDE VIA KNIFE' };
      const sideLog = gameState.logs.find(l => l.includes(`side for ${mapName}`));
      if(sideLog) { 
          const match = sideLog.match(/(?:\[SIDE\]|\() (.*?) chose (.*?) side/); 
          if(match) return { type: 'decider', sideText: `${match[1]} CHOSE ${match[2]}` }; 
      }
      return null;
  };

  const styles = getStyles(isMobile);

  // --- RENDER ADMIN ---
  if (isAdminRoute) {
      const activeCount = historyData.filter(m => !m.finished).length;
      return (
          <div style={{...styles.container, background:'#05070a'}}>
              <h1 style={{...styles.neonTitle, marginTop: '20px', fontSize:'2.5rem'}}>CONTROL PANEL</h1>
              <div style={{position:'absolute', top:'20px', right:'20px', color:'#00d4ff', fontSize:'0.9rem', cursor:'pointer'}} onClick={()=>{localStorage.removeItem('adminSecret'); window.location.reload();}}>LOGOUT</div>
              <button onClick={goHome} style={{position:'absolute', top:'20px', left:'20px', background:'transparent', border:'1px solid #444', color:'#fff', padding:'5px 10px'}}>← PUBLIC HOME</button>
              
              {!isAdminAuthenticated ? (
                  <div style={styles.glassPanel}>
                      <h3 style={{color:'#aaa', marginBottom:'20px'}}>AUTHENTICATE</h3>
                      <input type="password" style={styles.input} value={adminSecret} onChange={e => setAdminSecret(e.target.value)} placeholder="ENTER KEY" />
                      <button onClick={()=>{fetchAdminHistory(adminSecret); fetchMapPool(adminSecret);}} style={{...styles.modeBtn, width:'100%', marginTop:'20px'}}>ACCESS</button>
                  </div>
              ) : (
                  <div style={{width:'95%', maxWidth:'1200px', marginTop:'30px', display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:'20px'}}>
                      <div style={{flex:1, display:'flex', flexDirection:'column', gap:'20px'}}>
                          <div style={{background:'#0f1219', border:'1px solid #333', borderRadius:'10px', padding:'20px'}}>
                              <h3 style={{color:'#fff', borderBottom:'1px solid #333', paddingBottom:'10px', marginBottom:'20px'}}>QUICK CREATE</h3>
                              <input style={{...styles.input, width:'100%', fontSize:'1rem', textAlign:'left'}} value={adminTeamA} onChange={e => setAdminTeamA(e.target.value)} placeholder="Team A Name" />
                              <input style={{...styles.input, width:'100%', fontSize:'1rem', textAlign:'left'}} value={adminTeamB} onChange={e => setAdminTeamB(e.target.value)} placeholder="Team B Name" />
                              <div style={{marginTop:'15px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', color:'#aaa', fontSize:'0.9rem', flexDirection:'column'}}>
                                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                      <input type="checkbox" checked={useTimer} onChange={e=>setUseTimer(e.target.checked)} style={{transform:'scale(1.2)'}} />
                                      <span>Enable Auto-Ban Timer</span>
                                  </div>
                                  {useTimer && (
                                      <div style={{display:'flex', gap:'5px', marginTop:'10px', flexWrap:'wrap', justifyContent:'center'}}>
                                          {[30, 45, 60, 90, 120].map(seconds => (
                                              <button
                                                  key={seconds}
                                                  onClick={() => setTimerDuration(seconds)}
                                                  style={{
                                                      ...styles.modeBtn,
                                                      background: timerDuration === seconds ? '#00d4ff' : 'transparent',
                                                      color: timerDuration === seconds ? '#000' : '#aaa',
                                                      borderColor: timerDuration === seconds ? '#00d4ff' : '#333',
                                                      padding: '5px 15px',
                                                      fontSize: '0.9rem'
                                                  }}
                                              >
                                                  {seconds}s
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                              <div style={{marginTop:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', color:'#ffd700', fontSize:'0.9rem'}}>
                                  <input type="checkbox" checked={useCoinFlip} onChange={e=>setUseCoinFlip(e.target.checked)} style={{transform:'scale(1.2)'}} />
                                  <span>Enable Coin Flip</span>
                              </div>
                              <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                                  <button style={{...styles.modeBtn, flex:1}} onClick={() => createMatch('bo1', true)}>Bo1</button>
                                  <button style={{...styles.modeBtn, flex:1}} onClick={() => createMatch('bo3', true)}>Bo3</button>
                                  <button style={{...styles.modeBtn, flex:1}} onClick={() => createMatch('bo5', true)}>Bo5</button>
                              </div>
                              {adminLinks && (
                                   <div style={{marginTop:'20px', background:'#000', padding:'10px', borderRadius:'5px'}}>
                                       <div style={{color:'#00d4ff', fontSize:'0.8rem', marginBottom:'5px'}}>LINKS GENERATED:</div>
                                       <div onClick={()=>handleCopyLogs(adminLinks.admin)} style={{cursor:'pointer', fontSize:'0.8rem', color:'#aaa', marginBottom:'5px', wordBreak:'break-all'}}><b>ADMIN:</b> {adminLinks.admin}</div>
                                       <div onClick={()=>handleCopyLogs(adminLinks.teamA)} style={{cursor:'pointer', fontSize:'0.8rem', color:'#aaa', marginBottom:'5px', wordBreak:'break-all'}}><b>TEAM A:</b> {adminLinks.teamA}</div>
                                       <div onClick={()=>handleCopyLogs(adminLinks.teamB)} style={{cursor:'pointer', fontSize:'0.8rem', color:'#aaa', marginBottom:'5px', wordBreak:'break-all'}}><b>TEAM B:</b> {adminLinks.teamB}</div>
                                   </div>
                              )}
                          </div>
                          {/* MAP POOL EDITOR */}
                          <div style={{background:'#0f1219', border:'1px solid #333', borderRadius:'10px', padding:'20px'}}>
                              <h3 style={{color:'#fff', borderBottom:'1px solid #333', paddingBottom:'10px', marginBottom:'20px'}}>MAP POOL EDITOR</h3>
                              <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'20px'}}>
                                  {mapPool.map((map, i) => (
                                      <div key={i} style={{background:'#161b22', padding:'5px 10px', borderRadius:'5px', display:'flex', alignItems:'center', gap:'8px', border:'1px solid #333'}}>
                                          <span style={{color: map.customImage ? '#00d4ff' : '#aaa', fontSize:'0.9rem'}}>{map.name}</span>
                                          <button onClick={() => handleDeleteMap(i)} style={{background:'transparent', border:'none', cursor:'pointer', color:'#ff4444', fontWeight:'bold', fontSize:'0.8rem', display:'flex', alignItems:'center'}}><TrashIcon/></button>
                                      </div>
                                  ))}
                              </div>
                              <div style={{display:'flex', gap:'5px', flexDirection:'column'}}>
                                  <input style={{...styles.input, width:'100%', margin:0, fontSize:'0.9rem'}} value={newMapName} onChange={e=>setNewMapName(e.target.value)} placeholder="New Map Name" />
                                  <input style={{...styles.input, width:'100%', margin:0, fontSize:'0.9rem'}} value={newMapImage} onChange={e=>setNewMapImage(e.target.value)} placeholder="Image URL (Optional)" />
                                  <button onClick={handleAddMap} style={{...styles.modeBtn, marginTop:'10px'}}>ADD MAP</button>
                              </div>
                          </div>
                      </div>
                      <div style={{flex:2, background:'#0f1219', border:'1px solid #333', borderRadius:'10px', padding:'20px'}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'1px solid #333', paddingBottom:'10px'}}>
                              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                  <h3 style={{color:'#fff', margin:0}}>HISTORY</h3>
                                  <button onClick={() => fetchAdminHistory(adminSecret)} style={{background:'transparent', border:'1px solid #444', borderRadius:'4px', color:'#00d4ff', cursor:'pointer', padding:'5px', display:'flex', alignItems:'center'}} title="Force Refresh"><RefreshIcon /></button>
                              </div>
                              <div style={{fontSize:'0.8rem', color:'#888'}}>ACTIVE: <span style={{color:'#00ff00'}}>{activeCount}</span> | TOTAL: {historyData.length}</div>
                          </div>
                          <div style={{maxHeight:'600px', overflowY:'auto'}}>
                              {historyData.map((match, i) => (
                                  <div key={i} style={{background:'#161b22', marginBottom:'10px', padding:'15px', borderRadius:'5px', borderLeft: match.finished ? '4px solid #333' : '4px solid #00ff00'}}>
                                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                          <div style={{fontWeight:'bold', color: match.finished ? '#888' : '#fff'}}>{match.teamA} vs {match.teamB} <span style={{fontSize:'0.7rem', background:'#333', padding:'2px 5px', borderRadius:'3px', marginLeft:'5px'}}>{match.format}</span></div>
                                          <div style={{display:'flex', gap:'10px'}}>
                                              {!match.finished && (
                                                  <button onClick={() => handleAdminUndo(match.id)} style={{background:'transparent', color:'#ffa500', border:'none', cursor:'pointer'}} title="Undo Last Step"><UndoIcon /></button>
                                              )}
                                              <button onClick={() => handleAdminReset(match.id)} style={{background:'transparent', color:'#00d4ff', border:'none', cursor:'pointer'}} title={match.finished ? "Restart Match" : "Reset Match"}><RefreshIcon /></button>
                                              <button onClick={() => deleteMatch(match.id)} style={{background:'transparent', color:'#ff4444', border:'none', cursor:'pointer'}}><TrashIcon /></button>
                                          </div>
                                      </div>
                                      <div style={{fontSize:'0.7rem', color:'#666', marginTop:'5px'}}>{new Date(match.date).toLocaleString()}</div>
                                      {match.keys && (
                                          <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                                              <button onClick={()=>openInNewTab(`/?room=${match.id}&key=${match.keys.admin}`)} style={styles.adminLinkBadge}>OPEN</button>
                                              <button onClick={()=>copyLink(match.id, match.keys.A)} style={styles.copyLinkBadge}>LINK A</button>
                                              <button onClick={()=>copyLink(match.id, match.keys.B)} style={styles.copyLinkBadge}>LINK B</button>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                          <button onClick={nukeHistory} style={{width:'100%', marginTop:'20px', background:'#330000', border:'1px solid #ff4444', color:'#ff4444', padding:'10px', cursor:'pointer', borderRadius:'5px'}}>NUKE ALL HISTORY</button>
                      </div>
                  </div>
              )}
              {showNotification && <div style={styles.notification}><CheckIcon /> COPIED TO CLIPBOARD</div>}
              <div style={styles.footer}>LOTGaming Admin System</div>
          </div>
      );
  }

  // --- RENDER HISTORY ---
  if (view === 'history') {
      return (
          <div style={styles.container}>
              <AnimatedBackground />
              <h1 style={styles.neonTitle}>VETO ARCHIVE</h1>
              <button onClick={() => setView('home')} style={styles.backBtn}>← RETURN HOME</button>
              
              {/* PAGINATION CONTROLS (TOP) */}
              <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'20px', marginBottom:'20px'}}>
                  <button 
                      onClick={() => handlePageChange(currentPage - 1)} 
                      disabled={currentPage === 1}
                      style={{...styles.modeBtn, padding:'10px 20px', fontSize:'0.9rem', opacity: currentPage === 1 ? 0.5 : 1}}
                  >
                      PREV
                  </button>
                  <span style={{fontWeight:'bold', fontSize:'1.1rem'}}>PAGE {currentPage} / {totalPages}</span>
                  <button 
                      onClick={() => handlePageChange(currentPage + 1)} 
                      disabled={currentPage === totalPages}
                      style={{...styles.modeBtn, padding:'10px 20px', fontSize:'0.9rem', opacity: currentPage === totalPages ? 0.5 : 1}}
                  >
                      NEXT
                  </button>
              </div>

              <div style={styles.historyList}>{historyData.map((match, i) => (<div key={i} style={styles.historyCard}><div style={styles.historyHeader}><div><span style={{color:'#00d4ff'}}>{match.teamA}</span> vs <span style={{color:'#ff0055'}}>{match.teamB}</span></div><span style={styles.formatTag}>{match.format}</span></div><div style={{fontSize:'0.8rem', color:'#888'}}>{new Date(match.date).toLocaleString()}</div><div style={styles.logBox}>{match.logs.map((l, idx) => <div key={idx} style={styles.logLine}>{l}</div>)}</div></div>))}</div>
              
              {/* PAGINATION CONTROLS (BOTTOM) */}
              <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'20px', marginTop:'20px'}}>
                   <button 
                      onClick={() => handlePageChange(currentPage - 1)} 
                      disabled={currentPage === 1}
                      style={{...styles.modeBtn, padding:'10px 20px', fontSize:'0.9rem', opacity: currentPage === 1 ? 0.5 : 1}}
                  >
                      PREV
                  </button>
                  <button 
                      onClick={() => handlePageChange(currentPage + 1)} 
                      disabled={currentPage === totalPages}
                      style={{...styles.modeBtn, padding:'10px 20px', fontSize:'0.9rem', opacity: currentPage === totalPages ? 0.5 : 1}}
                  >
                      NEXT
                  </button>
              </div>

              <div style={styles.footer}>LOTGaming System | Made by &lt;3 kancha@lotgaming.xyz</div>
          </div>
      );
  }

  // --- RENDER MAIN HOME ---
  if (!params.room) {
    return (
      <div style={styles.container}>
        <AnimatedBackground />
        <div style={styles.glassPanel}>
            {/* UPDATED HEADER LAYOUT */}
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px'}}>
                 <img src={LOGO_URL} alt="Logo" style={styles.logo} />
                 <h1 style={styles.neonTitle}>LOT GAMING</h1>
            </div>
            
            <h3 style={{color:'#aaa', letterSpacing:'4px', marginBottom:'30px', fontSize: isMobile ? '0.8rem' : '1rem'}}>COUNTER STRIKE MAP VETO SYSTEM</h3>
            
            {/* VETO MODE SWITCHER - NOW RESPONSIVE */}
            <div style={{display:'flex', justifyContent:'center', marginBottom:'20px', gap:'10px', flexWrap: 'wrap'}}>
                <button onClick={()=>setVetoMode('vrs')} style={vetoMode === 'vrs' ? styles.modeBtnActive : styles.modeBtn}>VRS VETO</button>
                <button onClick={()=>setVetoMode('faceit')} style={vetoMode === 'faceit' ? styles.modeBtnActive : styles.modeBtn}>FACEIT STYLE</button>
                <button onClick={()=>setVetoMode('wingman')} style={vetoMode === 'wingman' ? styles.modeBtnActive : styles.modeBtn}>WINGMAN VETO</button>
                <button onClick={()=>setVetoMode('custom')} style={vetoMode === 'custom' ? styles.modeBtnActive : styles.modeBtn}>CUSTOM VETO</button>
            </div>

            <input style={{...styles.input, border: inputError && !teamA.trim() ? '2px solid #ff4444' : '1px solid #333'}} value={teamA} onChange={e => { setTeamA(e.target.value); setInputError(false); }} placeholder="TEAM A NAME (REQUIRED)" />
            
            {/* FILE UPLOAD A */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'15px'}}>
                <input type="file" ref={fileInputA} style={{display:'none'}} accept="image/*" onChange={(e)=>handleLogoUpload(e, 'A')} />
                <button onClick={()=>fileInputA.current.click()} style={{...styles.tinyBtn, padding:'5px 15px', display:'flex', alignItems:'center', gap:'5px'}}>
                    <UploadIcon /> {teamALogo ? "CHANGE LOGO A" : "ATTACH LOGO A"}
                </button>
                {teamALogo && <img src={teamALogo} alt="Preview" style={{width:'30px', height:'30px', objectFit:'contain', border:'1px solid #333', borderRadius:'3px'}} />}
            </div>

            <input style={{...styles.input, border: inputError && !teamB.trim() ? '2px solid #ff4444' : '1px solid #333'}} value={teamB} onChange={e => { setTeamB(e.target.value); setInputError(false); }} placeholder="TEAM B NAME (REQUIRED)" />
            
            {/* FILE UPLOAD B */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'15px'}}>
                <input type="file" ref={fileInputB} style={{display:'none'}} accept="image/*" onChange={(e)=>handleLogoUpload(e, 'B')} />
                <button onClick={()=>fileInputB.current.click()} style={{...styles.tinyBtn, padding:'5px 15px', display:'flex', alignItems:'center', gap:'5px'}}>
                    <UploadIcon /> {teamBLogo ? "CHANGE LOGO B" : "ATTACH LOGO B"}
                </button>
                {teamBLogo && <img src={teamBLogo} alt="Preview" style={{width:'30px', height:'30px', objectFit:'contain', border:'1px solid #333', borderRadius:'3px'}} />}
            </div>
            
            <div style={{marginTop:'15px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', color:'#aaa', fontSize:'0.9rem', flexDirection:'column'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <input type="checkbox" checked={useTimer} onChange={e=>setUseTimer(e.target.checked)} style={{transform:'scale(1.2)'}} />
                    <span>Enable Auto-Ban Timer</span>
                </div>
                {useTimer && (
                    <div style={{display:'flex', gap:'5px', marginTop:'10px', flexWrap:'wrap', justifyContent:'center'}}>
                        {[30, 45, 60, 90, 120].map(seconds => (
                            <button
                                key={seconds}
                                onClick={() => setTimerDuration(seconds)}
                                style={{
                                    ...styles.modeBtn,
                                    background: timerDuration === seconds ? '#00d4ff' : 'transparent',
                                    color: timerDuration === seconds ? '#000' : '#aaa',
                                    borderColor: timerDuration === seconds ? '#00d4ff' : '#333',
                                    padding: '5px 15px',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {seconds}s
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* NEW: COIN FLIP TOGGLE */}
            <div style={{marginTop:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', color:'#ffd700', fontSize:'0.9rem'}}>
                <input type="checkbox" checked={useCoinFlip} onChange={e=>setUseCoinFlip(e.target.checked)} style={{transform:'scale(1.2)'}} />
                <span>Enable Coin Flip</span>
            </div>

            {/* MODE SELECTION LOGIC */}
            {vetoMode !== 'custom' ? (
                <div style={{display:'flex', gap:'15px', justifyContent:'center', marginTop:'20px'}}>
                    <button style={styles.modeBtn} onClick={() => createMatch('bo1')}>Bo1</button>
                    <button style={styles.modeBtn} onClick={() => createMatch('bo3')}>Bo3</button>
                    {vetoMode !== 'wingman' && <button style={styles.modeBtn} onClick={() => createMatch('bo5')}>Bo5</button>}
                </div>
            ) : (
                <div style={{marginTop:'40px', textAlign:'left', borderTop:'1px solid #333', paddingTop:'30px'}}>
                    <h4 style={{color:'#00d4ff', marginBottom:'15px'}}>1. SELECT MAP POOL</h4>
                    
                    <div style={{display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'15px'}}>
                        {availableMaps.map(m => (
                            <div key={m.name} onClick={()=>toggleMapSelection(m.name)} 
                                style={{
                                    padding:'5px 10px', borderRadius:'5px', cursor:'pointer', fontSize:'0.8rem',
                                    border: customSelectedMaps.includes(m.name) ? '1px solid #00ff00' : '1px solid #333',
                                    color: customSelectedMaps.includes(m.name) ? '#fff' : '#666',
                                    background: customSelectedMaps.includes(m.name) ? 'rgba(0,255,0,0.1)' : 'transparent'
                                }}>
                                {m.name}
                            </div>
                        ))}
                    </div>

                    <div style={{display:'flex', gap:'10px', alignItems:'center', background:'rgba(255,255,255,0.05)', padding:'10px', borderRadius:'5px', marginBottom:'20px'}}>
                        <span style={{fontSize:'0.8rem', color:'#aaa'}}>ADD CUSTOM MAP:</span>
                        <input 
                            style={{...styles.input, margin:0, width:'150px', fontSize:'0.9rem', padding:'5px', height:'35px', textAlign:'left'}} 
                            placeholder="Map Name" 
                            value={userCustomMap} 
                            onChange={e=>setUserCustomMap(e.target.value)}
                        />
                        <button onClick={addUserMap} style={{...styles.tinyBtn, height:'35px', border:'1px solid #00ff00', color:'#00ff00', padding:'0 15px', fontWeight:'bold'}}>ADD</button>
                    </div>

                    <h4 style={{color:'#00d4ff'}}>2. DEFINE BAN ORDER</h4>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'10px'}}>
                        <button style={styles.tinyBtn} onClick={()=>addSequenceStep('A', 'ban')}>+ A BAN</button>
                        <button style={styles.tinyBtn} onClick={()=>addSequenceStep('B', 'ban')}>+ B BAN</button>
                        <button style={styles.tinyBtn} onClick={()=>addSequenceStep('A', 'pick')}>+ A PICK</button>
                        <button style={styles.tinyBtn} onClick={()=>addSequenceStep('B', 'pick')}>+ B PICK</button>
                        <button style={styles.tinyBtn} onClick={()=>addSequenceStep('A', 'side')}>+ A SIDE</button>
                        <button style={styles.tinyBtn} onClick={()=>addSequenceStep('B', 'side')}>+ B SIDE</button>
                        <button style={{...styles.tinyBtn, borderColor:'#ffa500', color:'#ffa500'}} onClick={()=>addSequenceStep('System', 'knife')}>+ KNIFE</button>
                    </div>
                    <div style={{background:'#000', padding:'10px', borderRadius:'5px', fontSize:'0.8rem', color:'#aaa', minHeight:'50px', display:'flex', flexWrap:'wrap', gap:'5px'}}>
                        {customSequence.length === 0 ? "No steps defined." : customSequence.map((s, i) => (
                            <span key={i} onClick={()=>removeSequenceStep(i)} style={{background:'#222', padding:'2px 6px', borderRadius:'3px', border:'1px solid #444', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px'}}>
                                {i+1}. {s.t} {s.a.toUpperCase()} <span style={{color:'#ff4444', fontWeight:'bold'}}>x</span>
                            </span>
                        ))}
                    </div>

                    <button style={{...styles.modeBtn, width:'100%', marginTop:'20px', borderColor:'#00ff00', color:'#00ff00'}} onClick={() => createMatch('custom')}>GENERATE CUSTOM MATCH</button>
                </div>
            )}

            {isGenerating && <div style={styles.generatingBox}><div style={styles.spinner}></div></div>}

            {createdLinks && !isGenerating && (
            <div style={styles.linksBox}>
                <div style={styles.linkRow}><span style={{color:'#aaa', fontWeight:'bold', minWidth:'70px'}}>ADMIN:</span> <input readOnly style={styles.linkInput} value={createdLinks.admin} onClick={() => handleCopyLogs(createdLinks.admin)}/><button onClick={() => openInNewTab(createdLinks.admin)} style={styles.iconBtn}><ExternalLinkIcon /></button></div>
                <div style={styles.linkRow}><span style={{color:'#00d4ff', fontWeight:'bold', minWidth:'70px'}}>TEAM A:</span> <input readOnly style={styles.linkInput} value={createdLinks.teamA} onClick={() => handleCopyLogs(createdLinks.teamA)}/><button onClick={() => openInNewTab(createdLinks.teamA)} style={{...styles.iconBtn, color: '#00d4ff'}}><ExternalLinkIcon /></button></div>
                <div style={styles.linkRow}><span style={{color:'#ff0055', fontWeight:'bold', minWidth:'70px'}}>TEAM B:</span> <input readOnly style={styles.linkInput} value={createdLinks.teamB} onClick={() => handleCopyLogs(createdLinks.teamB)}/><button onClick={() => openInNewTab(createdLinks.teamB)} style={{...styles.iconBtn, color: '#ff0055'}}><ExternalLinkIcon /></button></div>
            </div>
            )}

            <button onClick={()=>fetchPublicHistory(1)} style={styles.historyBtn}>VIEW PAST VETOS</button>
        </div>
        <div style={{...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)'}}><CheckIcon /> COPIED TO CLIPBOARD</div>
        <div style={styles.footer}>LOTGaming System | Made by &lt;3 kancha@lotgaming.xyz</div>
      </div>
    );
  }

  // --- RENDER VETO ---
  if (!gameState) return <div style={styles.container}><AnimatedBackground /><h1 style={styles.neonTitle}>INITIALIZING...</h1></div>;

  // COIN FLIP OVERLAY
  if (gameState.useCoinFlip && gameState.coinFlip.status !== 'done') {
      return (
          <div style={styles.container}>
              <AnimatedBackground />
              <CoinFlipOverlay 
                  gameState={gameState} 
                  myRole={myRole} 
                  onCall={handleCoinCall} 
                  onDecide={handleCoinDecide} 
              />
          </div>
      );
  }

  const currentStep = gameState.sequence[gameState.step];
  const isActionStep = currentStep && (currentStep.a === 'ban' || currentStep.a === 'pick');
  const isSideStep = currentStep && currentStep.a === 'side';
  const isMyTurn = !gameState.finished && currentStep?.t === myRole; 
  const actionColor = currentStep?.a === 'ban' ? '#ff4444' : '#00ff00';
  let sidePickMapName = gameState.lastPickedMap;
  if (!sidePickMapName && isSideStep) { const decider = gameState.maps.find(m => m.status === 'available'); if(decider) sidePickMapName = decider.name; }

  // Check if current user needs to click READY
  const showReadyButton = gameState.useTimer && !gameState.finished && (myRole === 'A' || myRole === 'B') && !gameState.ready[myRole];
  
  // ROLE DATA
  const roleData = getRoleLabel();

  return (
    <div style={styles.container}>
      <AnimatedBackground />
      <button onClick={goHome} style={styles.homeBtn} title="Exit to Main Menu"><HomeIcon /> EXIT TO MENU</button>
      <button 
        onClick={() => {
          const newState = !soundEnabled;
          setSoundEnabled(newState);
          localStorage.setItem('soundEnabled', newState);
        }} 
        style={{
          position: 'absolute', 
          top: isMobile ? '10px' : '20px', 
          right: isMobile ? '10px' : '20px', 
          background: soundEnabled ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)', 
          border: `1px solid ${soundEnabled ? '#00d4ff' : '#666'}`, 
          color: soundEnabled ? '#00d4ff' : '#888', 
          padding: '8px 15px', 
          borderRadius: '5px', 
          cursor: 'pointer', 
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          zIndex: 100,
          fontFamily: "'Rajdhani', sans-serif"
        }} 
        title={soundEnabled ? "Disable Sounds" : "Enable Sounds"}
      >
        {soundEnabled ? '🔊' : '🔇'} {soundEnabled ? 'SOUND ON' : 'SOUND OFF'}
      </button>
      {showRules && <RulesModal format={gameState.format} isMobile={isMobile} onClose={() => setShowRules(false)} />}
      <div style={{...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)'}}><CheckIcon /> COPIED TO CLIPBOARD</div>

      {/* UPDATED SCOREBOARD WITH LOGOS */}
      <div style={styles.scoreboard}>
        <div style={{...styles.teamName, color: '#00d4ff', display:'flex', alignItems:'center', gap:'15px'}}>
            {gameState.teamALogo && <img src={gameState.teamALogo} alt="" style={styles.teamLogo} />}
            {gameState.teamA}
        </div>
        <div style={styles.vsBadge}>VS</div>
        <div style={{...styles.teamName, color: '#ff0055', display:'flex', alignItems:'center', gap:'15px', flexDirection: 'row-reverse'}}>
            {gameState.teamBLogo && <img src={gameState.teamBLogo} alt="" style={styles.teamLogo} />}
            {gameState.teamB}
        </div>
      </div>

      <div style={{...styles.statusBar, borderColor: isMyTurn ? actionColor : '#333', boxShadow: isMyTurn ? `0 0 10px ${actionColor}22` : 'none'}}>
          <h2>
              {getInstruction()}
              {/* TIMER DISPLAY */}
              <Countdown endsAt={gameState.timerEndsAt} soundEnabled={soundEnabled} />
          </h2>
      </div>

      {/* READY BUTTON OVERLAY OR INSERTION */}
      {showReadyButton && (
          <div style={{textAlign:'center', marginBottom:'20px'}}>
              <button onClick={handleReady} style={{...styles.modeBtn, fontSize:'1.5rem', background:'#00d4ff', color:'#000', border:'none', padding:'15px 40px', boxShadow:'0 0 20px rgba(0, 212, 255, 0.5)'}}>
                  CLICK TO READY UP
              </button>
          </div>
      )}

      {isSideStep && (
        <div style={styles.sideSelectionContainer}>
           <h2 style={{marginBottom:'30px', textShadow:'0 0 10px white', fontSize: isMobile ? '1.2rem' : '2rem'}}>SELECT SIDE FOR {sidePickMapName?.toUpperCase()}</h2>
           {isMyTurn ? (
               <div style={{display:'flex', gap: isMobile ? '10px' : '40px', justifyContent:'center', alignItems:'stretch'}}>
                   <div onMouseEnter={() => setHoveredItem('CT')} onMouseLeave={() => setHoveredItem(null)} style={{...styles.sideCard, border: '2px solid #4facfe', boxShadow: hoveredItem === 'CT' ? '0 0 40px rgba(79, 172, 254, 0.6)' : 'none', transform: hoveredItem === 'CT' ? 'scale(1.05)' : 'scale(1)'}} onClick={() => handleAction('CT')}>
                       <img src="/CT.png" alt="CT" style={styles.sideImg} /><div style={styles.sideLabelCT}>CT</div>
                   </div>
                   <div onMouseEnter={() => setHoveredItem('T')} onMouseLeave={() => setHoveredItem(null)} style={{...styles.sideCard, border: '2px solid #ff9a9e', boxShadow: hoveredItem === 'T' ? '0 0 40px rgba(255, 154, 158, 0.6)' : 'none', transform: hoveredItem === 'T' ? 'scale(1.05)' : 'scale(1)'}} onClick={() => handleAction('T')}>
                       <img src="/T.png" alt="T" style={styles.sideImg} /><div style={styles.sideLabelT}>T</div>
                   </div>
               </div>
           ) : <h3 style={{color:'#888'}}>WAITING FOR OPPONENT...</h3>}
        </div>
      )}

      {!isSideStep && (
        <div style={styles.grid}>
          {gameState.maps.map(map => {
            const areTeamsReady = !gameState.useTimer || (gameState.ready.A && gameState.ready.B);
            const isInteractive = areTeamsReady && isMyTurn && isActionStep && map.status === 'available';
            
            const isHovered = hoveredItem === map.name;
            const logData = getMapLogData(map.name);
            const playIndex = gameState.playedMaps ? gameState.playedMaps.indexOf(map.name) : -1;
            const mapOrderLabel = playIndex !== -1 ? `MAP ${playIndex + 1}` : null;
            
            const imageUrl = map.customImage 
                ? map.customImage 
                : `https://raw.githubusercontent.com/sivert-io/cs2-server-manager/refs/heads/master/map_thumbnails/de_${map.name.toLowerCase()}.png`;
            
            // Secondary Fallback
            const secondaryUrl = `https://image.gametracker.com/images/maps/160x120/csgo/de_${map.name.toLowerCase()}.jpg`;

            const cardStyle = {
                ...styles.mapCard,
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url(${imageUrl}), url(${secondaryUrl})`,
                opacity: map.status === 'banned' ? 0.3 : 1,
                filter: map.status === 'banned' ? 'grayscale(100%)' : 'none',
                border: map.status === 'picked' ? '3px solid #00ff00' : map.status === 'decider' ? '3px solid #ffa500' : isInteractive ? `2px solid ${actionColor}` : '1px solid rgba(255,255,255,0.1)',
                cursor: (map.status === 'available' && isMyTurn) ? 'pointer' : 'default',
                boxShadow: (isInteractive && isHovered) ? `0 0 20px ${actionColor}` : '0 5px 15px rgba(0,0,0,0.5)',
                transform: (isInteractive && isHovered) ? 'scale(1.05) translateY(-5px)' : 'scale(1)'
            };
            return (
                <div key={map.name} onMouseEnter={() => setHoveredItem(map.name)} onMouseLeave={() => setHoveredItem(null)} onClick={() => isInteractive ? handleAction(map.name) : null} style={cardStyle}>
                  {map.status === 'picked' && mapOrderLabel && <div style={styles.mapOrderBadge}>{mapOrderLabel}</div>}
                  <div style={styles.cardContent}>
                    <span style={styles.mapTitle}>{map.name}</span>
                    {map.status === 'banned' && <div style={styles.badgeBan}>BANNED BY {logData?.team || '...'}</div>}
                    {map.status === 'picked' && <div style={styles.badgePick}>PICKED BY {logData?.team || '...'} <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING...'}</div></div>}
                    {map.status === 'decider' && <div style={styles.badgeDecider}>DECIDER <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING FOR SIDE'}</div></div>}
                  </div>
                </div>
            );
          })}
        </div>
      )}

      {/* --- INSERTED ROLE BADGE HERE --- */}
      <div style={{
          marginTop: '20px', marginBottom: '10px',
          padding: '10px 30px', borderRadius: '50px',
          background: 'rgba(0,0,0,0.5)', border: `2px solid ${roleData.color}`,
          color: roleData.color, fontSize: '1.2rem', fontWeight: 'bold',
          textTransform: 'uppercase', letterSpacing: '2px',
          boxShadow: `0 0 15px ${roleData.color}44`
      }}>
          {roleData.text}
      </div>

      <div style={styles.logContainer}>
        <div style={styles.logHeader}><span>VETO LOGS</span>{gameState.finished && <button onClick={() => handleCopyLogs(gameState.logs.join('\n'))} style={styles.copyBtn}><span style={{marginRight:'5px'}}>COPY</span> <CopyIcon /></button>}</div>
        <div style={styles.logScroll}>{gameState.logs.map((log, i) => <div key={i} style={styles.logRow}><span style={{color:'#444', marginRight:'15px', fontFamily:'monospace'}}>{(i+1).toString().padStart(2, '0')}.</span><LogLineRenderer log={log} teamA={gameState.teamA} teamB={gameState.teamB} /></div>)}</div>
      </div>
      <div style={styles.footer}>LOTGaming System | Made by &lt;3 kancha@lotgaming.xyz</div>
    </div>
  );
}

// --- DYNAMIC STYLES ---
const getStyles = (isMobile) => ({
  container: { minHeight: '100vh', color: '#fff', fontFamily: "'Rajdhani', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '50px', overflowX: 'hidden' },
  // UPDATED LOGO STYLE
  logo: { width: isMobile ? '50px' : '80px', filter: 'drop-shadow(0 0 10px rgba(0, 212, 255, 0.4))' },
  
  generatingBox: { marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
  spinner: { width: '40px', height: '40px', border: '4px solid rgba(0, 212, 255, 0.3)', borderTop: '4px solid #00d4ff', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  homeBtn: { position: 'absolute', top: isMobile ? '10px' : '20px', left: isMobile ? '10px' : '20px', background: 'rgba(0,0,0,0.5)', border: '1px solid #444', color: '#fff', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', transition: '0.2s', zIndex: 100 },
  neonTitle: { fontSize: isMobile ? '2rem' : '3.5rem', margin: 0, fontWeight: '700', letterSpacing: isMobile ? '2px' : '8px', background: 'linear-gradient(to right, #00d4ff, #ff0055)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 30px rgba(0, 212, 255, 0.3)', textAlign: 'center' },
  glassPanel: { background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', padding: isMobile ? '20px' : '60px', textAlign: 'center', marginTop: '10vh', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', width: isMobile ? '90%' : 'auto' },
  notification: { position: 'fixed', bottom: '30px', right: isMobile ? '5%' : '30px', width: isMobile ? '90%' : 'auto', zIndex: 1000, background: 'rgba(10, 15, 25, 0.95)', borderLeft: '5px solid #00d4ff', padding: '15px 25px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)', transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)', backdropFilter: 'blur(10px)' },
  input: { display: 'block', width: isMobile ? '100%' : '300px', padding: '15px', margin: '15px auto', background: 'rgba(0,0,0,0.4)', borderRadius: '5px', color: '#fff', fontSize: '1.2rem', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '2px', boxSizing: 'border-box' },
  modeBtn: { padding: '15px 30px', background: 'rgba(0, 212, 255, 0.1)', border: '2px solid #00d4ff', color: '#00d4ff', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: '0.2s', fontFamily: "'Rajdhani', sans-serif", boxShadow: '0 0 15px rgba(0, 212, 255, 0.2)', flex: 1 },
  modeBtnActive: { padding: '15px 30px', background: '#00d4ff', border: '2px solid #00d4ff', color: '#000', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: '0.2s', fontFamily: "'Rajdhani', sans-serif", boxShadow: '0 0 15px rgba(0, 212, 255, 0.5)', flex: 1 },
  tinyBtn: { padding: '5px 10px', background: 'transparent', border: '1px solid #00d4ff', color: '#00d4ff', borderRadius: '3px', cursor: 'pointer', fontSize: '0.7rem' },
  scoreboard: { display: 'flex', alignItems: 'center', gap: isMobile ? '15px' : '40px', marginTop: '40px', flexWrap: 'wrap', justifyContent: 'center' },
  teamName: { fontSize: isMobile ? '1.8rem' : '3rem', fontWeight: 'bold', textTransform: 'uppercase', textShadow: '0 0 20px rgba(0,0,0,0.5)' },
  vsBadge: { fontSize: '1.5rem', color: '#444', fontStyle: 'italic', fontWeight: '900' },
  statusBar: { width: isMobile ? '90%' : '80%', maxWidth: '800px', textAlign: 'center', padding: '15px', background: 'rgba(0,0,0,0.6)', borderRadius: '10px', margin: '30px 0', border: '1px solid #333', textTransform: 'uppercase', letterSpacing: '2px', transition: '0.3s ease', fontSize: isMobile ? '0.8rem' : '1rem' },
  grid: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? '10px' : '20px', maxWidth: '1400px', padding: '10px' },
  mapCard: { width: isMobile ? '44vw' : '160px', height: isMobile ? '60vw' : '240px', borderRadius: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' },
  cardContent: { position: 'absolute', bottom: '0', width: '100%', padding: '10px', background: 'linear-gradient(to top, black, transparent)' },
  mapTitle: { fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', lineHeight: '1' },
  badgeBan: { marginTop: '5px', color: '#ff4444', fontWeight: 'bold', textTransform: 'uppercase', fontSize: isMobile ? '0.8rem' : '1rem' },
  badgePick: { marginTop: '5px', color: '#00ff00', fontWeight: 'bold', textTransform: 'uppercase', fontSize: isMobile ? '0.8rem' : '1rem' },
  badgeDecider: { marginTop: '5px', color: '#ffa500', fontWeight: 'bold', textTransform: 'uppercase', fontSize: isMobile ? '0.8rem' : '1rem' },
  miniSideBadge: { background: 'white', color: 'black', padding: '2px 5px', borderRadius: '3px', display: 'block', marginTop: '3px', fontSize: '0.7rem', width: 'fit-content' },
  sideSelectionContainer: { textAlign: 'center', margin: '50px 0', width: '100%' },
  sideCard: { width: isMobile ? '45%' : '300px', height: isMobile ? 'auto' : '320px', cursor: 'pointer', transition: 'all 0.3s ease', borderRadius: '15px', overflow:'hidden', background:'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px' },
  sideImg: { width: '100%', height: isMobile ? '120px' : '220px', objectFit:'contain', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))', padding:'20px' },
  sideLabelCT: { fontSize: isMobile ? '1.2rem' : '1.5rem', color: '#4facfe', fontWeight: 'bold', letterSpacing: '2px' },
  sideLabelT: { fontSize: isMobile ? '1.2rem' : '1.5rem', color: '#ff9a9e', fontWeight: 'bold', letterSpacing: '2px' },
  
  // LOG BOX STYLES
  logContainer: { width: isMobile ? '95%' : '80%', maxWidth: '800px', background: '#0a0d14', border: '1px solid #333', borderRadius: '10px', marginTop: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden' },
  logHeader: { padding: '15px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: '#fff' },
  logScroll: { padding: '20px', maxHeight: '300px', overflowY: 'auto', background: '#05070a' },
  logRow: { marginBottom: '8px', display: 'flex', alignItems: 'flex-start', lineHeight: '1.5' },
  copyBtn: { background: '#00d4ff', border: 'none', padding: '5px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center', fontSize: '0.8rem', transition: '0.2s' },

  historyBtn: { marginTop: '30px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid #666', color: '#fff', padding: '12px 30px', borderRadius: '30px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', letterSpacing: '2px', transition: 'all 0.3s ease', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', fontFamily: "'Rajdhani', sans-serif", textTransform: 'uppercase' },
  historyList: { width: isMobile ? '95%' : '80%', maxWidth: '800px', marginTop: '40px' },
  historyCard: { background: 'rgba(20, 25, 35, 0.9)', marginBottom: '15px', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #00d4ff', boxShadow: '0 5px 20px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' },
  historyHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 'bold', textTransform: 'uppercase', width: '100%' },
  
  backBtn: { background: 'none', border: '1px solid #444', color: '#fff', padding: '10px 20px', cursor: 'pointer', marginBottom: '20px' },
  footer: { marginTop: 'auto', padding: '20px', color: '#444', fontSize: '0.8rem', letterSpacing: '1px', textAlign: 'center' },
  
  // NEW STYLES
  teamLogo: { height: '50px', width: '50px', objectFit: 'contain', borderRadius: '5px', background: 'rgba(255,255,255,0.1)', padding:'2px' },
  mapOrderBadge: {
      position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.8)', border: '1px solid #00d4ff', color: '#fff',
      padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem',
      boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)', zIndex: 10
  },
  
  // UPDATED LINK BOX STYLES
  linksBox: { marginTop: '30px', padding: '25px', background: 'rgba(15, 20, 30, 0.95)', borderRadius: '15px', border: '1px solid rgba(0, 212, 255, 0.2)', boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', width: '100%', boxSizing: 'border-box', animation: 'fadeIn 0.5s ease-out' },
  linkRow: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', background: 'rgba(0, 0, 0, 0.3)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' },
  linkInput: { flex: 1, background: 'transparent', border: 'none', color: '#00d4ff', fontFamily: "'Consolas', monospace", fontSize: '0.9rem', cursor: 'pointer', outline: 'none', textOverflow: 'ellipsis' },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: '5px', marginLeft: '5px', display: 'flex', alignItems: 'center', transition: '0.2s' },

  adminLinkBadge: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed #fff', color: '#fff',
      padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', textDecoration: 'none', cursor: 'pointer'
  },
  copyLinkBadge: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: 'rgba(0,0,0,0.3)', border: '1px solid',
      padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer'
  }
});