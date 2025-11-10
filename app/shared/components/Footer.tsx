import Link from "next/link";
import packageJson from "../../../package.json";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    {/* Left: Version */}
                    <div>
                        v{packageJson.version}
                    </div>

                    {/* Center: Copyright */}
                    <div>
                        © {currentYear} Sfinx. All rights reserved.
                    </div>

                    {/* Right: Link */}
                    <div>
                        <Link 
                            href="https://sfinx.info" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            sfinx.info
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

