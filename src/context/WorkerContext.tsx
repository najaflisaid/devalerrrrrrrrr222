import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getEmployeeByEmail } from '../services/employeeService';
import { Employee } from '../types/worker';

interface WorkerContextType {
  user: User | null;
  employee: Employee | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorker must be used within WorkerProvider');
  }
  return context;
};

export const WorkerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Admin yoxla
        if (firebaseUser.email === 'admin@devaleur.az') {
          setIsAdmin(true);
          setEmployee(null);
        } else {
          // İşçi məlumatını al
          const emp = await getEmployeeByEmail(firebaseUser.email!);
          setEmployee(emp);
          setIsAdmin(false);
        }
      } else {
        setEmployee(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setEmployee(null);
      setIsAdmin(false);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  return (
    <WorkerContext.Provider value={{ user, employee, isAdmin, loading, login, logout }}>
      {children}
    </WorkerContext.Provider>
  );
};
