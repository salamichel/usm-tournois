import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import type { FlexiblePhaseConfig } from '@shared/types';

interface FlexibleKingConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (phases: FlexiblePhaseConfig[]) => void;
  registeredPlayersCount: number;
  existingPhases?: FlexiblePhaseConfig[];
}

const FlexibleKingConfigModal: React.FC<FlexibleKingConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  registeredPlayersCount,
  existingPhases,
}) => {
  const [phases, setPhases] = useState<FlexiblePhaseConfig[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (existingPhases && existingPhases.length > 0) {
      setPhases(existingPhases);
    } else {
      // Default: 3 phases (4v4 → 3v3 → 2v2)
      setPhases([
        {
          phaseNumber: 1,
          gameMode: '4v4',
          phaseFormat: 'round-robin',
          playersPerTeam: 4,
          totalTeams: Math.floor(registeredPlayersCount / 4),
          numberOfPools: 3,
          teamsPerPool: Math.floor(registeredPlayersCount / 4 / 3),
          qualifiedPerPool: 4,
          totalQualified: 12,
          fields: 3,
          estimatedRounds: 3,
          totalMatches: 27,
          estimatedTime: 162,
          setsPerMatch: 2,
          pointsPerSet: 21,
          tieBreakEnabled: true,
        },
        {
          phaseNumber: 2,
          gameMode: '3v3',
          phaseFormat: 'kob',
          playersPerTeam: 3,
          totalTeams: 4,
          numberOfPools: 2,
          teamsPerPool: 2,
          qualifiedPerPool: 4,
          totalQualified: 8,
          fields: 2,
          estimatedRounds: 5,
          totalMatches: 10,
          estimatedTime: 100,
          setsPerMatch: 2,
          pointsPerSet: 21,
          tieBreakEnabled: true,
        },
        {
          phaseNumber: 3,
          gameMode: '2v2',
          phaseFormat: 'kob',
          playersPerTeam: 2,
          totalTeams: 4,
          numberOfPools: 1,
          teamsPerPool: 4,
          qualifiedPerPool: 2,
          totalQualified: 2,
          fields: 1,
          estimatedRounds: 5,
          totalMatches: 5,
          estimatedTime: 50,
          setsPerMatch: 2,
          pointsPerSet: 21,
          tieBreakEnabled: true,
        },
      ]);
    }
  }, [isOpen, existingPhases, registeredPlayersCount]);

  const validatePhases = (): boolean => {
    const newErrors: string[] = [];

    if (phases.length === 0) {
      newErrors.push('Au moins une phase est requise');
      setErrors(newErrors);
      return false;
    }

    // Check phase numbers are sequential
    const phaseNumbers = phases.map(p => p.phaseNumber).sort((a, b) => a - b);
    for (let i = 0; i < phaseNumbers.length; i++) {
      if (phaseNumbers[i] !== i + 1) {
        newErrors.push(`Les numéros de phase doivent être séquentiels (1, 2, 3...)`);
        break;
      }
    }

    // Validate each phase
    phases.forEach((phase, index) => {
      if (phase.numberOfPools < 1) {
        newErrors.push(`Phase ${phase.phaseNumber}: Au moins 1 poule requise`);
      }

      if (phase.totalQualified < 1) {
        newErrors.push(`Phase ${phase.phaseNumber}: Au moins 1 joueur qualifié requis`);
      }

      if (phase.totalTeams < phase.numberOfPools) {
        newErrors.push(`Phase ${phase.phaseNumber}: Nombre d'équipes insuffisant pour ${phase.numberOfPools} poules`);
      }

      // Phase 1 must have enough players
      if (phase.phaseNumber === 1) {
        const expectedPlayers = phase.totalTeams * phase.playersPerTeam;
        if (expectedPlayers > registeredPlayersCount) {
          newErrors.push(
            `Phase 1: ${expectedPlayers} joueurs requis mais seulement ${registeredPlayersCount} inscrits`
          );
        }
      }

      // Subsequent phases: qualified from previous must match expected players
      if (index > 0) {
        const previousPhase = phases[index - 1];
        const expectedPlayers = phase.totalTeams * phase.playersPerTeam;
        if (previousPhase.totalQualified !== expectedPlayers) {
          newErrors.push(
            `Phase ${phase.phaseNumber}: Attendu ${expectedPlayers} joueurs mais phase ${previousPhase.phaseNumber} qualifie ${previousPhase.totalQualified} joueurs`
          );
        }
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleAddPhase = () => {
    const newPhaseNumber = phases.length + 1;
    const previousPhase = phases[phases.length - 1];

    const newPhase: FlexiblePhaseConfig = {
      phaseNumber: newPhaseNumber,
      gameMode: '2v2',
      phaseFormat: 'kob',
      playersPerTeam: 2,
      totalTeams: previousPhase ? Math.floor(previousPhase.totalQualified / 2) : 4,
      numberOfPools: 1,
      teamsPerPool: 4,
      qualifiedPerPool: 2,
      totalQualified: 2,
      fields: 1,
      estimatedRounds: 3,
      totalMatches: 6,
      estimatedTime: 36,
      setsPerMatch: 2,
      pointsPerSet: 21,
      tieBreakEnabled: true,
    };

    setPhases([...phases, newPhase]);
  };

  const handleRemovePhase = (phaseNumber: number) => {
    const updatedPhases = phases
      .filter(p => p.phaseNumber !== phaseNumber)
      .map((p, index) => ({ ...p, phaseNumber: index + 1 }));
    setPhases(updatedPhases);
  };

  const handlePhaseChange = (phaseNumber: number, field: keyof FlexiblePhaseConfig, value: any) => {
    const updatedPhases = phases.map(phase => {
      if (phase.phaseNumber === phaseNumber) {
        const updated = { ...phase, [field]: value };

        // Auto-calculate dependent fields
        if (field === 'gameMode') {
          updated.playersPerTeam = parseInt(value.replace('v', ''));
        }

        if (field === 'numberOfPools' || field === 'totalTeams') {
          updated.teamsPerPool = Math.floor(updated.totalTeams / updated.numberOfPools);
        }

        if (field === 'numberOfPools' || field === 'totalQualified') {
          updated.qualifiedPerPool = Math.floor(updated.totalQualified / updated.numberOfPools);
        }

        // Estimate matches and time
        if (field === 'phaseFormat' || field === 'numberOfPools' || field === 'totalTeams' || field === 'teamsPerPool') {
          if (updated.phaseFormat === 'round-robin') {
            const teamsPerPool = Math.floor(updated.totalTeams / updated.numberOfPools);
            const matchesPerPool = (teamsPerPool * (teamsPerPool - 1)) / 2;
            updated.totalMatches = matchesPerPool * updated.numberOfPools;
            updated.estimatedRounds = Math.ceil(matchesPerPool / updated.fields);
          } else {
            // KOB
            const teamsPerPool = Math.floor(updated.totalTeams / updated.numberOfPools);
            const matchesPerRound = Math.floor(teamsPerPool / 2);
            updated.estimatedRounds = 5; // Default for KOB
            updated.totalMatches = matchesPerRound * updated.estimatedRounds * updated.numberOfPools;
          }

          updated.estimatedTime = updated.totalMatches * 6; // 6 minutes per match
        }

        return updated;
      }
      return phase;
    });

    setPhases(updatedPhases);
  };

  const handleSave = () => {
    if (validatePhases()) {
      onSave(phases);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Configuration des Phases</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Joueurs inscrits:</strong> {registeredPlayersCount}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Configurez chaque phase du tournoi King. Le nombre de qualifiés d'une phase doit correspondre au nombre
              de joueurs attendus pour la phase suivante.
            </p>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-2">Erreurs de validation</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Phases */}
          <div className="space-y-4">
            {phases.map((phase, _index) => (
              <div key={phase.phaseNumber} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Phase {phase.phaseNumber}</h3>
                  {phases.length > 1 && (
                    <button
                      onClick={() => handleRemovePhase(phase.phaseNumber)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode de jeu</label>
                    <select
                      value={phase.gameMode}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'gameMode', e.target.value)}
                      className="input w-full"
                    >
                      <option value="6v6">6v6</option>
                      <option value="5v5">5v5</option>
                      <option value="4v4">4v4</option>
                      <option value="3v3">3v3</option>
                      <option value="2v2">2v2</option>
                      <option value="1v1">1v1</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <select
                      value={phase.phaseFormat}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'phaseFormat', e.target.value)}
                      className="input w-full"
                    >
                      <option value="round-robin">Round Robin</option>
                      <option value="kob">King of the Beach</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Équipes totales</label>
                    <input
                      type="number"
                      min="1"
                      value={phase.totalTeams}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'totalTeams', parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de poules</label>
                    <input
                      type="number"
                      min="1"
                      value={phase.numberOfPools}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'numberOfPools', parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Joueurs qualifiés</label>
                    <input
                      type="number"
                      min="1"
                      value={phase.totalQualified}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'totalQualified', parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Terrains</label>
                    <input
                      type="number"
                      min="1"
                      value={phase.fields}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'fields', parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sets par match</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={phase.setsPerMatch}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'setsPerMatch', parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points par set</label>
                    <input
                      type="number"
                      min="11"
                      max="30"
                      value={phase.pointsPerSet}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'pointsPerSet', parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`tie-break-${phase.phaseNumber}`}
                      checked={phase.tieBreakEnabled}
                      onChange={e => handlePhaseChange(phase.phaseNumber, 'tieBreakEnabled', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor={`tie-break-${phase.phaseNumber}`} className="text-sm font-medium text-gray-700">
                      Tie-break activé
                    </label>
                  </div>
                </div>

                {/* Calculated values */}
                <div className="mt-4 pt-4 border-t border-gray-300 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-sm">
                    <span className="text-gray-600">Joueurs attendus:</span>
                    <span className="ml-2 font-bold">{phase.totalTeams * phase.playersPerTeam}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Équipes/Poule:</span>
                    <span className="ml-2 font-bold">{phase.teamsPerPool}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Matchs estimés:</span>
                    <span className="ml-2 font-bold">{phase.totalMatches}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Durée estimée:</span>
                    <span className="ml-2 font-bold">{phase.estimatedTime} min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Phase Button */}
          <button onClick={handleAddPhase} className="btn-secondary w-full flex items-center justify-center gap-2">
            <Plus size={18} />
            Ajouter une Phase
          </button>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save size={18} />
            Enregistrer la Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlexibleKingConfigModal;
