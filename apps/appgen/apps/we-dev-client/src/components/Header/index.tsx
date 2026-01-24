import { ProjectTitle } from "./ProjectTitle";
import { HeaderActions } from "./HeaderActions";

function Header() {
  return (
    <header className="min-h-12 flex items-center px-4 h-12 glass border-b bg-white dark:bg-gray-900">
      <div className="flex-1">
        <ProjectTitle />
      </div>
      
      {/* Logo and Brand */}
      <div className="flex items-center space-x-2">
        <img className="w-20 h-auto" src="public/assets/icons/logo_white.png" alt="logo" />
        <h1 className="opacity-90 text-[18px] font-bold text-gray-900 dark:text-white">APPGEN</h1>
      </div>
      
      <div className="flex-1 flex justify-end">
        <HeaderActions />
      </div>
    </header>
  );
}

export default Header;
