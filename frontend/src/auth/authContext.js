import { createContext } from 'react';

// Holds { session, loading, login, logout } for the whole app
export const AuthContext = createContext(null);