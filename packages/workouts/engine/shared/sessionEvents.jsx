import React,{createContext,useContext} from 'react';
const SessionContext=createContext(null);
export const SessionProvider=SessionContext.Provider;
export function useSessionReporter(){const report=useContext(SessionContext);return event=>report?.(event);}
