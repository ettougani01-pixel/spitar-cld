import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SpitarIdBadge } from "./SpitarIdBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, User, LogOut, ChevronDown, HeartPulse, QrCode } from "lucide-react";
import { SpitarLogoMark } from "./SpitarLogoMark";

export function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <SpitarLogoMark size={34} />
              <span className="text-xl font-extrabold text-[#0057B8] tracking-tight">SPITAR</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 h-9">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {user.firstName?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:inline text-sm font-medium">{user.firstName}</span>
                    <ChevronDown className="w-4 h-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                    {user.spitarId && <SpitarIdBadge id={user.spitarId} size="sm" className="mt-1" />}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">
                      <LayoutDashboard className="w-4 h-4 me-2" />
                      {t("nav.dashboard")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <User className="w-4 h-4 me-2" />
                      {t("nav.profile")}
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "patient" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/health">
                          <HeartPulse className="w-4 h-4 me-2" />
                          {t("nav.health_profile")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/qr">
                          <QrCode className="w-4 h-4 me-2" />
                          {t("nav.qr_access")}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                    <LogOut className="w-4 h-4 me-2" />
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">{t("nav.login")}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">{t("nav.register")}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
