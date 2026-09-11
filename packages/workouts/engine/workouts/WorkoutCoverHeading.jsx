import React from 'react';
import './workout-cover-heading.css';
export default function WorkoutCoverHeading({eyebrow,title,cover}){
 return <div className="workout-cover-heading"><div><div className="prs-eyebrow">{eyebrow}</div><h1>{title}</h1></div><img src={cover} alt={`${title} cover`} decoding="async"/></div>;
}
