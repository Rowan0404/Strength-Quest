import React from 'react';

export function Scale({
  min, max, value, onChange, label, left, right
}:{
  min: number;
  max: number;
  value: number;
  onChange: (n:number)=>void;
  label: string;
  left?: string;
  right?: string;
}){
  const nums = [];
  for (let i=min;i<=max;i++) nums.push(i);

  return (
    <div style={{marginTop:10}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:900}}>{label}</div>
        <div className="pill teal">{value}</div>
      </div>
      <div className="scaleRow" role="radiogroup" aria-label={label}>
        {nums.map(n=>(
          <button
            key={n}
            className={n===value ? "scaleBtn active" : "scaleBtn"}
            onClick={()=>onChange(n)}
            role="radio"
            aria-checked={n===value}
          >
            {n}
          </button>
        ))}
      </div>
      {(left || right) && (
        <div className="row" style={{justifyContent:'space-between', marginTop:6}}>
          <div className="muted">{left ?? ''}</div>
          <div className="muted">{right ?? ''}</div>
        </div>
      )}
    </div>
  );
}
