import { createContext, useContext } from 'react';

export const ShellContext = createContext({ summary: null, setMeta: () => {} });
export const useShell = () => useContext(ShellContext);