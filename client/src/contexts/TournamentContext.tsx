import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { TournamentSummary, TournamentDetails } from '@shared/types';
import tournamentService from '@services/tournament.service';
import toast from 'react-hot-toast';

interface TournamentContextType {
  tournaments: TournamentSummary[];
  currentTournament: TournamentDetails | null;
  isLoading: boolean;
  fetchTournaments: () => Promise<void>;
  fetchTournamentById: (id: string) => Promise<void>;
  refreshCurrentTournament: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within TournamentProvider');
  }
  return context;
};

interface TournamentProviderProps {
  children: ReactNode;
}

export const TournamentProvider: React.FC<TournamentProviderProps> = ({ children }) => {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [currentTournament, setCurrentTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentTournamentRef = useRef<TournamentDetails | null>(null);

  // Keep ref in sync with state
  currentTournamentRef.current = currentTournament;

  const fetchTournaments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await tournamentService.getAllTournaments();
      if (response.success && response.data) {
        setTournaments(response.data.tournaments);
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Erreur lors du chargement des tournois';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTournamentById = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await tournamentService.getTournamentById(id);
      if (response.success && response.data) {
        setCurrentTournament(response.data.tournament);
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Erreur lors du chargement du tournoi';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCurrentTournament = useCallback(async () => {
    // Use ref to avoid dependency on currentTournament state
    if (currentTournamentRef.current) {
      await fetchTournamentById(currentTournamentRef.current.id);
    }
  }, [fetchTournamentById]);

  const value: TournamentContextType = {
    tournaments,
    currentTournament,
    isLoading,
    fetchTournaments,
    fetchTournamentById,
    refreshCurrentTournament,
  };

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
};
