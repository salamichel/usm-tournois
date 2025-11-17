/**
 * Modal component for editing match scores
 * Used by both pool and elimination matches
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface MatchScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sets: any[]) => Promise<void>;
  match: any;
  setsToWin: number;
  pointsPerSet: number;
}

const MatchScoreModal = ({
  isOpen,
  onClose,
  onSave,
  match,
  setsToWin,
  pointsPerSet,
}: MatchScoreModalProps) => {
  const [sets, setSets] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && match) {
      // Initialize sets from match data or create empty sets
      if (match.sets && Array.isArray(match.sets)) {
        setSets(match.sets.map((set: any) => ({
          score1: set.score1 ?? null,
          score2: set.score2 ?? null,
        })));
      } else {
        // Create empty sets based on setsToWin
        setSets(Array.from({ length: setsToWin }, () => ({
          score1: null,
          score2: null,
        })));
      }
    }
  }, [isOpen, match, setsToWin]);

  const handleSetChange = (index: number, team: 'score1' | 'score2', value: string) => {
    const newSets = [...sets];
    const numValue = value === '' ? null : parseInt(value);
    newSets[index] = {
      ...newSets[index],
      [team]: numValue,
    };
    setSets(newSets);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(sets);
      onClose();
    } catch (error) {
      console.error('Error saving scores:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Modifier les scores</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Match Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <p className="font-semibold text-gray-900">{match?.team1?.name || 'Équipe 1'}</p>
              </div>
              <div className="text-center text-gray-500 text-sm">VS</div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">{match?.team2?.name || 'Équipe 2'}</p>
              </div>
            </div>
          </div>

          {/* Sets Scores */}
          <div className="space-y-4">
            {sets.map((set, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-20 text-sm font-medium text-gray-700">
                  Set {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                  {/* Team 1 Score */}
                  <input
                    type="number"
                    min="0"
                    value={set.score1 ?? ''}
                    onChange={(e) => handleSetChange(index, 'score1', e.target.value)}
                    className="input text-center text-lg font-semibold"
                    placeholder="0"
                  />

                  {/* Separator */}
                  <div className="text-center text-gray-400">-</div>

                  {/* Team 2 Score */}
                  <input
                    type="number"
                    min="0"
                    value={set.score2 ?? ''}
                    onChange={(e) => handleSetChange(index, 'score2', e.target.value)}
                    className="input text-center text-lg font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Configuration :</strong> {setsToWin} set(s) à gagner, {pointsPerSet} points par set
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Le match sera automatiquement marqué comme terminé quand une équipe gagne {setsToWin} set(s)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchScoreModal;
