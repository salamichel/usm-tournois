import React, { useState, useEffect } from 'react';
import {
  KingConfiguration,
  PhaseConfig,
  suggestKingConfigurations,
  validateKingConfiguration,
  GameMode
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
  Trash2
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
    newConfig.phases[phaseIndex] = { ...newConfig.phases[phaseIndex], [field]: value };

    setSelectedConfig(newConfig);
    setCustomConfig(newConfig);
  };

  const handleAddPhase = () => {
    if (!selectedConfig) return;

    const lastPhase = selectedConfig.phases[selectedConfig.phases.length - 1];
    const newPhase: PhaseConfig = {
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
    };

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
          <div className="border-t border-gray-200 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total joueurs</p>
              <p className="font-semibold text-lg">{totalPlayers}</p>
            </div>
            <div>
              <p className="text-gray-600">Phases</p>
              <p className="font-semibold text-lg">{selectedConfig.phases.length}</p>
            </div>
            <div>
              <p className="text-gray-600">Durée estimée</p>
              <p className="font-semibold text-lg">{selectedConfig.estimatedDuration}</p>
            </div>
            <div>
              <p className="text-gray-600">Qualifiés final</p>
              <p className="font-semibold text-lg text-yellow-600">1 KING 👑</p>
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
  return (
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
  );
};

// Composant pour prévisualiser une phase
const PhasePreview: React.FC<{ phase: PhaseConfig }> = ({ phase }) => {
  return (
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
          <strong>{phase.numberOfPools}</strong> poule(s) de {phase.teamsPerPool}
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
          <strong>{phase.estimatedRounds}</strong> rounds KOB
        </span>
      </div>

      <div className="col-span-2 text-gray-600">
        {phase.setsPerMatch} set(s) de {phase.pointsPerSet} pts
        {phase.tieBreakEnabled && ' • Tie-break'}
      </div>
    </div>
  );
};

export default KingConfigAssistant;
