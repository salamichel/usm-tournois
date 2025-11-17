import React, { useState, useEffect } from 'react';
import {
  KingConfiguration,
  PhaseConfig,
  suggestKingConfigurations,
  validateKingConfiguration,
  GameMode,
  enrichPhaseWithTimings,
  customizePhaseWithPools,
  MAX_TEAMS_PER_POOL,
  generateMatchSchedule,
  ScheduledMatch
} from '@utils/kingConfigSuggestions';
import {
  Users,
  MapPin,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Edit2,
  Plus,
  Trash2,
  Trophy,
  Clock,
  Layers
} from 'lucide-react';

interface KingConfigAssistantProps {
  totalPlayers: number;
  availableFields: number;
  onConfigSelect?: (config: KingConfiguration) => void;
}

const KingConfigAssistant: React.FC<KingConfigAssistantProps> = ({
  totalPlayers,
  availableFields,
  onConfigSelect
}) => {
  const [suggestions, setSuggestions] = useState<KingConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<KingConfiguration | null>(null);
  const [_customConfig, setCustomConfig] = useState<KingConfiguration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (totalPlayers >= 6 && availableFields >= 1) {
      const configs = suggestKingConfigurations(totalPlayers, availableFields);
      setSuggestions(configs);

      // Sélectionner la première suggestion par défaut
      if (configs.length > 0 && !selectedConfig) {
        setSelectedConfig(configs[0]);
      }
    }
  }, [totalPlayers, availableFields]);

  useEffect(() => {
    if (selectedConfig) {
      const errors = validateKingConfiguration(selectedConfig);
      setValidationErrors(errors);
    }
  }, [selectedConfig]);

  const handleConfigSelect = (config: KingConfiguration) => {
    setSelectedConfig(config);
    setCustomConfig(null);
    setIsEditing(false);

    if (onConfigSelect) {
      onConfigSelect(config);
    }
  };

  const handleEditPhase = (phaseIndex: number, field: keyof PhaseConfig, value: any) => {
    if (!selectedConfig) return;

    const newConfig = { ...selectedConfig };
    newConfig.phases = [...newConfig.phases];

    // Cas spécial: changement du nombre de poules nécessite un recalcul complet
    if (field === 'numberOfPools') {
      try {
        const currentPhase = newConfig.phases[phaseIndex];
        newConfig.phases[phaseIndex] = customizePhaseWithPools(currentPhase, value as number);
      } catch (error) {
        console.error('Erreur lors du changement du nombre de poules:', error);
        return;
      }
    } else if (field === 'totalQualified') {
      // Cas spécial: changement du nombre de qualifiés
      const updatedPhase = { ...newConfig.phases[phaseIndex], totalQualified: value };

      // Recalculer qualifiedPerPool (moyenne)
      updatedPhase.qualifiedPerPool = Math.floor(value / updatedPhase.numberOfPools);

      // Si poolDistribution existe, recalculer qualifiedPerPoolDistribution
      if (updatedPhase.poolDistribution) {
        try {
          const currentPhase = newConfig.phases[phaseIndex];
          const tempPhase = { ...currentPhase, totalQualified: value };
          newConfig.phases[phaseIndex] = customizePhaseWithPools(tempPhase, tempPhase.numberOfPools);
        } catch (error) {
          console.error('Erreur lors du changement du nombre de qualifiés:', error);
          return;
        }
      } else {
        newConfig.phases[phaseIndex] = enrichPhaseWithTimings(updatedPhase);
      }
    } else {
      // Mettre à jour le champ modifié
      const updatedPhase = { ...newConfig.phases[phaseIndex], [field]: value };

      // Recalculer les valeurs dépendantes
      newConfig.phases[phaseIndex] = enrichPhaseWithTimings(updatedPhase);
    }

    setSelectedConfig(newConfig);
    setCustomConfig(newConfig);
  };

  const handleAddPhase = () => {
    if (!selectedConfig) return;

    const lastPhase = selectedConfig.phases[selectedConfig.phases.length - 1];
    const newPhase = enrichPhaseWithTimings({
      phaseNumber: selectedConfig.phases.length + 1,
      gameMode: '2v2',
      playersPerTeam: 2,
      teamsPerPool: lastPhase.totalQualified,
      numberOfPools: 1,
      totalTeams: lastPhase.totalQualified,
      qualifiedPerPool: 1,
      totalQualified: 1,
      fields: 1,
      estimatedRounds: 5,
      setsPerMatch: 3,
      pointsPerSet: 21,
      tieBreakEnabled: true,
    });

    const newConfig = { ...selectedConfig };
    newConfig.phases = [...newConfig.phases, newPhase];
    setSelectedConfig(newConfig);
    setCustomConfig(newConfig);
  };

  const handleRemovePhase = (phaseIndex: number) => {
    if (!selectedConfig || selectedConfig.phases.length <= 2) return;

    const newConfig = { ...selectedConfig };
    newConfig.phases = newConfig.phases.filter((_, i) => i !== phaseIndex);

    // Renumber phases
    newConfig.phases.forEach((phase, i) => {
      phase.phaseNumber = i + 1;
    });

    setSelectedConfig(newConfig);
    setCustomConfig(newConfig);
  };

  if (totalPlayers < 6 || availableFields < 1) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertCircle size={20} />
          <p className="font-medium">
            Veuillez renseigner au moins 6 joueurs et 1 terrain pour obtenir des suggestions
          </p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertCircle size={20} />
          <p className="font-medium">
            Aucune configuration optimale trouvée pour {totalPlayers} joueurs et {availableFields} terrain(s)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Assistant de Configuration King Mode
        </h3>
        <p className="text-sm text-gray-700">
          Configuration pour <strong>{totalPlayers} joueurs</strong> avec <strong>{availableFields} terrain(s)</strong>
        </p>
      </div>

      {/* Suggestions */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">Configurations suggérées :</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {suggestions.map((config, index) => (
            <button
              key={index}
              onClick={() => handleConfigSelect(config)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                selectedConfig === config
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-1">{config.description}</p>
                  <p className="text-sm text-gray-600 mb-2">
                    {config.phases.length} phases • {config.estimatedDuration}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {config.phases.map((phase, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium px-2 py-1 bg-white border border-gray-300 rounded"
                      >
                        {phase.gameMode}
                      </span>
                    ))}
                  </div>
                </div>
                {selectedConfig === config && (
                  <CheckCircle className="text-blue-500 flex-shrink-0 ml-2" size={20} />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Prévisualisation détaillée */}
      {selectedConfig && (
        <div className="bg-white border border-gray-300 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Détails de la configuration</h4>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit2 size={16} />
              {isEditing ? 'Terminer l\'édition' : 'Personnaliser'}
            </button>
          </div>

          {/* Erreurs de validation */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="font-medium text-red-900 text-sm mb-1">Problèmes détectés :</p>
                  <ul className="text-sm text-red-800 space-y-1">
                    {validationErrors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Timeline des phases */}
          <div className="space-y-3">
            {selectedConfig.phases.map((phase, index) => (
              <div key={index} className="relative">
                {/* Connecteur */}
                {index < selectedConfig.phases.length - 1 && (
                  <div className="absolute left-6 top-full h-3 w-0.5 bg-gray-300" />
                )}

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    {/* Numéro de phase */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                      {phase.phaseNumber}
                    </div>

                    {/* Détails de la phase */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-900">
                          Phase {phase.phaseNumber} - {phase.gameMode}
                        </h5>
                        {isEditing && selectedConfig.phases.length > 2 && (
                          <button
                            onClick={() => handleRemovePhase(index)}
                            className="text-red-600 hover:text-red-700"
                            title="Supprimer cette phase"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <PhaseEditor
                          phase={phase}
                          onUpdate={(field, value) => handleEditPhase(index, field, value)}
                        />
                      ) : (
                        <PhasePreview phase={phase} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bouton ajouter phase */}
          {isEditing && (
            <button
              onClick={handleAddPhase}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Ajouter une phase
            </button>
          )}

          {/* Résumé */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total joueurs</p>
                <p className="font-semibold text-lg">{totalPlayers}</p>
              </div>
              <div>
                <p className="text-gray-600">Phases</p>
                <p className="font-semibold text-lg">{selectedConfig.phases.length}</p>
              </div>
              <div>
                <p className="text-gray-600">Total matchs</p>
                <p className="font-semibold text-lg text-blue-600">{selectedConfig.totalMatches}</p>
              </div>
              <div>
                <p className="text-gray-600">Durée totale</p>
                <p className="font-semibold text-lg text-purple-600">{selectedConfig.estimatedTotalDisplay}</p>
              </div>
              <div>
                <p className="text-gray-600">Qualifiés final</p>
                <p className="font-semibold text-lg text-yellow-600">1 KING 👑</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded">
              ℹ️ Estimation basée sur {selectedConfig.availableFields} terrain{selectedConfig.availableFields > 1 ? 's' : ''} •
              {selectedConfig.estimatedDuration} recommandé{selectedConfig.estimatedDuration.includes('-') ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour éditer une phase
const PhaseEditor: React.FC<{
  phase: PhaseConfig;
  onUpdate: (field: keyof PhaseConfig, value: any) => void;
}> = ({ phase, onUpdate }) => {
  const maxPools = phase.totalTeams;
  const minPools = Math.max(1, Math.ceil(phase.totalTeams / MAX_TEAMS_PER_POOL));

  // Calcul des limites pour le nombre de qualifiés (en JOUEURS)
  const totalPlayersInPhase = phase.totalTeams * phase.playersPerTeam;
  const minQualified = phase.playersPerTeam; // Au moins une équipe complète
  const maxQualified = totalPlayersInPhase - phase.playersPerTeam; // Au moins une équipe non qualifiée

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="block text-gray-600 mb-1">Mode de jeu</label>
          <select
            value={phase.gameMode}
            onChange={(e) => onUpdate('gameMode', e.target.value as GameMode)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
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
          <label className="block text-gray-600 mb-1">Terrains</label>
          <input
            type="number"
            min="1"
            value={phase.fields}
            onChange={(e) => onUpdate('fields', parseInt(e.target.value))}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-gray-600 mb-1">
            Nombre de poules
            <span className="text-xs text-gray-500 ml-1">({minPools}-{maxPools})</span>
          </label>
          <input
            type="number"
            min={minPools}
            max={maxPools}
            value={phase.numberOfPools}
            onChange={(e) => onUpdate('numberOfPools', parseInt(e.target.value))}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-gray-600 mb-1">
            Joueurs qualifiés
            <span className="text-xs text-gray-500 ml-1">({minQualified}-{maxQualified})</span>
          </label>
          <input
            type="number"
            min={minQualified}
            max={maxQualified}
            value={phase.totalQualified}
            onChange={(e) => onUpdate('totalQualified', parseInt(e.target.value))}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-gray-600 mb-1">Sets par match</label>
          <input
            type="number"
            min="1"
            max="5"
            value={phase.setsPerMatch}
            onChange={(e) => onUpdate('setsPerMatch', parseInt(e.target.value))}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-gray-600 mb-1">Points par set</label>
          <input
            type="number"
            min="11"
            max="30"
            value={phase.pointsPerSet}
            onChange={(e) => onUpdate('pointsPerSet', parseInt(e.target.value))}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={phase.tieBreakEnabled}
              onChange={(e) => onUpdate('tieBreakEnabled', e.target.checked)}
              className="rounded"
            />
            Tie-break activé
          </label>
        </div>
      </div>

      {/* Prévisualisation de la répartition des poules */}
      {phase.poolDistribution && phase.poolDistribution.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-blue-600" />
            <span className="font-medium text-blue-900">Répartition des poules :</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {phase.poolDistribution.map((teams, index) => (
              <span key={index} className="bg-white px-2 py-1 rounded border border-blue-300 text-blue-900">
                Poule {index + 1}: <strong>{teams}</strong> équipe{teams > 1 ? 's' : ''}
                {phase.qualifiedPerPoolDistribution && phase.qualifiedPerPoolDistribution[index] !== undefined && (
                  <span className="text-green-600 ml-1">
                    (→ {phase.qualifiedPerPoolDistribution[index]} qualifié{phase.qualifiedPerPoolDistribution[index] > 1 ? 's' : ''})
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour visualiser le planning des matchs
const MatchScheduleViewer: React.FC<{ phase: PhaseConfig }> = ({ phase }) => {
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);

  const handleGenerateSchedule = () => {
    const generated = generateMatchSchedule(phase);
    setSchedule(generated);
    setShowSchedule(true);
  };

  if (!showSchedule) {
    return (
      <button
        onClick={handleGenerateSchedule}
        className="text-xs text-blue-600 hover:text-blue-700 underline"
      >
        📅 Voir le planning des matchs
      </button>
    );
  }

  // Regrouper par round
  const matchesByRound = schedule.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, ScheduledMatch[]>);

  return (
    <div className="bg-gray-50 border border-gray-300 rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Planning des matchs</h4>
        <button
          onClick={() => setShowSchedule(false)}
          className="text-xs text-gray-600 hover:text-gray-800"
        >
          ✕ Fermer
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.entries(matchesByRound).map(([round, matches]) => (
          <div key={round} className="bg-white rounded border border-gray-200 p-2">
            <div className="font-medium text-xs text-blue-700 mb-2">
              Round {round} ({matches.length} match{matches.length > 1 ? 's' : ''})
            </div>
            <div className="space-y-1">
              {matches.map((match, idx) => (
                <div key={idx} className="text-xs flex items-center gap-2 py-1">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                    T{match.fieldNumber}
                  </span>
                  <span className="text-gray-500">Poule {match.pool}</span>
                  <span className="flex-1 text-gray-900">
                    Équipe {match.team1 + 1} vs Équipe {match.team2 + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 border-t border-gray-200 pt-2">
        💡 Les matchs d'un même round peuvent se jouer en parallèle sur différents terrains
      </div>
    </div>
  );
};

// Composant pour prévisualiser une phase
const PhasePreview: React.FC<{ phase: PhaseConfig }> = ({ phase }) => {
  return (
    <div className="space-y-3">
      {/* Ligne 1: Infos de base */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <span>
            <strong>{phase.totalTeams}</strong> équipes ({phase.playersPerTeam} joueurs)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-gray-400" />
          <span>
            <strong>{phase.numberOfPools}</strong> poule(s)
            {phase.poolDistribution ? '' : ` de ${phase.teamsPerPool}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ChevronRight size={16} className="text-green-500" />
          <span>
            <strong>{phase.totalQualified}</strong> qualifié(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <span>
            <strong>{phase.estimatedRounds}</strong> rounds {phase.phaseFormat === 'round-robin' ? 'RR' : 'KOB'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-blue-500" />
          <span>
            <strong>{phase.totalMatches}</strong> matchs total
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Clock size={16} className="text-purple-500" />
          <span>
            Durée: <strong>{phase.estimatedDurationDisplay}</strong>
          </span>
        </div>
      </div>

      {/* Distribution des poules (si poules déséquilibrées) */}
      {phase.poolDistribution && phase.poolDistribution.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-blue-600" />
            <span className="font-medium text-blue-900">Répartition :</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {phase.poolDistribution.map((teams, index) => (
              <span key={index} className="text-blue-900">
                <strong>{teams}</strong> équipe{teams > 1 ? 's' : ''}
                {index < phase.poolDistribution!.length - 1 && <span className="mx-1">•</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ligne 2: Règles de jeu */}
      <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
        {phase.setsPerMatch} set(s) de {phase.pointsPerSet} pts
        {phase.tieBreakEnabled && ' • Tie-break'}
        {' • '}
        {phase.fields} terrain{phase.fields > 1 ? 's' : ''} utilisé{phase.fields > 1 ? 's' : ''}
      </div>

      {/* Ligne 3: Planning des matchs */}
      <MatchScheduleViewer phase={phase} />
    </div>
  );
};

export default KingConfigAssistant;
