import { Search, Filter } from 'lucide-react';

interface TournamentFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
}

const TournamentFilters = ({
  searchQuery,
  setSearchQuery,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
}: TournamentFiltersProps) => {
  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter size={20} className="text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Filtres de recherche</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recherche par texte */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom, lieu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        {/* Filtre par type */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input w-full"
          >
            <option value="all">Tous les types</option>
            <option value="4">4x4</option>
            <option value="2">2x2</option>
            <option value="6">6x6</option>
          </select>
        </div>

        {/* Filtre par statut */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input w-full"
          >
            <option value="all">Tous les statuts</option>
            <option value="Ouvert">Ouvert</option>
            <option value="Complet">Complet</option>
            <option value="Liste d'attente">Liste d'attente</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default TournamentFilters;
