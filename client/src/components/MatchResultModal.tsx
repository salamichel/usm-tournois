import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface MatchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (setsWonTeam1: number, setsWonTeam2: number) => void;
  match: any;
}

const MatchResultModal: React.FC<MatchResultModalProps> = ({ isOpen, onClose, onSave, match }) => {
  const [setsWonTeam1, setSetsWonTeam1] = useState(0);
  const [setsWonTeam2, setSetsWonTeam2] = useState(0);

  useEffect(() => {
    if (match) {
      setSetsWonTeam1(match.setsWonTeam1 || 0);
      setSetsWonTeam2(match.setsWonTeam2 || 0);
    }
  }, [match]);

  const handleSave = () => {
    onSave(setsWonTeam1, setsWonTeam2);
  };

  if (!isOpen || !match) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Enregistrer le Résultat</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Match Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Team 1 */}
              <div className="text-center">
                <h3 className="font-bold text-lg mb-2">{match.team1?.name || 'Équipe 1'}</h3>
                {match.team1?.members && (
                  <div className="space-y-1">
                    {match.team1.members.map((player: any, idx: number) => (
                      <div key={idx} className="text-sm text-gray-600">
                        {player.pseudo || player.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* VS */}
              <div className="text-center">
                <span className="text-gray-400 text-2xl font-bold">VS</span>
              </div>

              {/* Team 2 */}
              <div className="text-center">
                <h3 className="font-bold text-lg mb-2">{match.team2?.name || 'Équipe 2'}</h3>
                {match.team2?.members && (
                  <div className="space-y-1">
                    {match.team2.members.map((player: any, idx: number) => (
                      <div key={idx} className="text-sm text-gray-600">
                        {player.pseudo || player.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Score Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
              Nombre de sets gagnés
            </label>
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Team 1 Score */}
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={setsWonTeam1}
                  onChange={e => setSetsWonTeam1(parseInt(e.target.value) || 0)}
                  className="input text-center text-3xl font-bold w-24"
                />
              </div>

              {/* Separator */}
              <div className="text-center">
                <span className="text-gray-400 text-4xl font-bold">-</span>
              </div>

              {/* Team 2 Score */}
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={setsWonTeam2}
                  onChange={e => setSetsWonTeam2(parseInt(e.target.value) || 0)}
                  className="input text-center text-3xl font-bold w-24"
                />
              </div>
            </div>
          </div>

          {/* Winner Display */}
          {(setsWonTeam1 > 0 || setsWonTeam2 > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 font-medium">
                {setsWonTeam1 > setsWonTeam2 ? (
                  <>
                    Vainqueur: <strong>{match.team1?.name || 'Équipe 1'}</strong>
                  </>
                ) : setsWonTeam2 > setsWonTeam1 ? (
                  <>
                    Vainqueur: <strong>{match.team2?.name || 'Équipe 2'}</strong>
                  </>
                ) : (
                  <>Match nul</>
                )}
              </p>
            </div>
          )}

          {/* Quick Score Buttons */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Scores rapides :</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setSetsWonTeam1(2);
                  setSetsWonTeam2(0);
                }}
                className="btn-secondary text-sm"
              >
                {match.team1?.name || 'Équipe 1'} 2-0
              </button>
              <button
                onClick={() => {
                  setSetsWonTeam1(0);
                  setSetsWonTeam2(2);
                }}
                className="btn-secondary text-sm"
              >
                {match.team2?.name || 'Équipe 2'} 2-0
              </button>
              <button
                onClick={() => {
                  setSetsWonTeam1(2);
                  setSetsWonTeam2(1);
                }}
                className="btn-secondary text-sm"
              >
                {match.team1?.name || 'Équipe 1'} 2-1
              </button>
              <button
                onClick={() => {
                  setSetsWonTeam1(1);
                  setSetsWonTeam2(2);
                }}
                className="btn-secondary text-sm"
              >
                {match.team2?.name || 'Équipe 2'} 2-1
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t p-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save size={18} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchResultModal;
