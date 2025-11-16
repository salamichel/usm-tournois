import React, { useState } from 'react';
import KingConfigAssistant from '@components/KingConfigAssistant';
import { KingConfiguration } from '@utils/kingConfigSuggestions';

/**
 * Page de démonstration pour l'assistant de configuration King Mode
 * Cette page permet de tester différents scénarios
 */
const KingConfigDemo: React.FC = () => {
  const [totalPlayers, setTotalPlayers] = useState(36);
  const [availableFields, setAvailableFields] = useState(3);
  const [selectedConfig, setSelectedConfig] = useState<KingConfiguration | null>(null);

  // Scénarios prédéfinis pour tester rapidement
  const scenarios = [
    { name: '24 joueurs, 2 terrains', players: 24, fields: 2 },
    { name: '36 joueurs, 3 terrains', players: 36, fields: 3 },
    { name: '48 joueurs, 4 terrains', players: 48, fields: 4 },
    { name: '60 joueurs, 4 terrains', players: 60, fields: 4 },
    { name: '72 joueurs, 6 terrains', players: 72, fields: 6 },
  ];

  const handleScenarioSelect = (players: number, fields: number) => {
    setTotalPlayers(players);
    setAvailableFields(fields);
    setSelectedConfig(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏐 Démo : Assistant de Configuration King Mode
          </h1>
          <p className="text-gray-600">
            Testez différents scénarios pour voir les configurations suggérées
          </p>
        </div>

        {/* Scénarios rapides */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scénarios prédéfinis</h2>
          <div className="flex flex-wrap gap-3">
            {scenarios.map((scenario, index) => (
              <button
                key={index}
                onClick={() => handleScenarioSelect(scenario.players, scenario.fields)}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  totalPlayers === scenario.players && availableFields === scenario.fields
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration personnalisée */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration personnalisée</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="totalPlayers" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de joueurs
              </label>
              <input
                type="number"
                id="totalPlayers"
                min="6"
                max="120"
                value={totalPlayers}
                onChange={(e) => setTotalPlayers(parseInt(e.target.value) || 6)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="availableFields" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de terrains disponibles
              </label>
              <input
                type="number"
                id="availableFields"
                min="1"
                max="10"
                value={availableFields}
                onChange={(e) => setAvailableFields(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Assistant de configuration */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <KingConfigAssistant
            totalPlayers={totalPlayers}
            availableFields={availableFields}
            onConfigSelect={(config) => setSelectedConfig(config)}
          />
        </div>

        {/* Résultat JSON (pour debug) */}
        {selectedConfig && (
          <div className="bg-gray-900 text-green-400 rounded-lg shadow-md p-6 mt-6 font-mono text-sm overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-bold">Configuration JSON (pour développeurs)</h3>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedConfig, null, 2))}
                className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copier
              </button>
            </div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedConfig, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default KingConfigDemo;
