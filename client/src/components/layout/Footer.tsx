const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="text-xl font-bold">USM Tournois</span>
            <p className="text-gray-400 text-sm mt-1">Gestion de tournois de volleyball</p>
          </div>

          <div className="text-sm text-gray-400">
            © {currentYear} USM Tournois. Tous droits réservés.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
