import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Workouts,configureAssets} from '../../../packages/workouts';
configureAssets('');
function App(){const [version,setVersion]=useState(0);return <Workouts key={version} onBack={()=>setVersion(v=>v+1)}/>;}
createRoot(document.getElementById('root')).render(<App/>);
