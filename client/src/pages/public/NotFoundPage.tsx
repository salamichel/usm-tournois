import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="text-xl text-gray-600 mt-4">Page non trouvée</p>
        <Link to="/" className="btn-primary mt-6 inline-block">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
