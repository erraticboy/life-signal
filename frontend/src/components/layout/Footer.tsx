import { Link } from "react-router-dom";
import { BrandLogo } from "../ui/BrandLogo";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="space-y-2">
            <BrandLogo />
            <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Report Problems. Discover Patterns. Build Better Cities. Urban infrastructure monitoring powered
              by computer vision, uncertainty calibration, and geospatial analytics.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/about" className="hover:text-slate-950 dark:hover:text-white">
              About
            </Link>
            <Link to="/how-it-works" className="hover:text-slate-950 dark:hover:text-white">
              How It Works
            </Link>
            <Link to="/contact" className="hover:text-slate-950 dark:hover:text-white">
              Contact
            </Link>
            <Link to="/login" className="hover:text-slate-950 dark:hover:text-white">
              Sign In
            </Link>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400 dark:border-slate-900 dark:text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
          <span>LIFE SIGNAL — Urban Infrastructure Intelligence Platform</span>
          <span>Phase 1: Core Architecture, PostgreSQL + PostGIS &amp; Firebase Auth</span>
        </div>
      </div>
    </footer>
  );
}

