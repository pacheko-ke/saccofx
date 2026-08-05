"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowDownRight,
  

  LineChart,
  Coins ,
  Banknote,
  Fingerprint,
  CreditCard ,
  MessageCircle ,
  Bell,
  Shield,
} from "lucide-react";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string; icon: React.ElementType }[];
};

const links: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
 
  // { href: "/dashboard/docs", label: "Documents", icon: FileText },

  // {
  //   label: "Settings",
  //   icon: Settings,
  //   children: [
  //     { href: "/dashboard/settings/notifications", label: "Notifications", icon: Bell },
  //     { href: "/dashboard/settings/security", label: "Security", icon: Shield },
  //   ],
  // },

  {
    label: "Membership",
    icon: Users,
    children: [
      { href: "/dashboard/members", label: "View Members", icon: Users },
      { href: "/dashboard/members/add", label: "Add Member", icon: Shield },
      { href: "/dashboard/members/cards", label: "Membership Cards", icon: Shield },
    ],
  },

  {
    label: "Payments & Collections",
    icon: Coins ,
    children: [
      { href: "/dashboard/members", label: "Teller Deposits", icon: Users },
      { href: "/dashboard/members/add", label: "Mobile Money", icon: Shield },
      { href: "/dashboard/members/cards", label: "Loan Repayments", icon: Shield },
      { href: "/dashboard/members/cards", label: "Cashbook", icon: Shield },
    ],
  },

    {
    label: "Lending",
    icon: CreditCard ,
    children: [
      { href: "/dashboard/members", label: "Active Loans", icon: Users },
      { href: "/dashboard/members/add", label: "Pending Approvals", icon: Shield },
      { href: "/dashboard/members/cards", label: "Loan History", icon: Shield },
      { href: "/dashboard/members/cards", label: "Defaulters", icon: Shield },
      { href: "/dashboard/members/cards", label: "Closed Loans", icon: Shield },
      { href: "/dashboard/members/cards", label: "Loan Products & Rates", icon: Shield },
    ],
  },

  {
    label: "Member Finances",
    icon: ArrowDownRight,
    children: [
      { href: "/dashboard/members", label: "Savings Accounts", icon: Users },
      { href: "/dashboard/members/add", label: "Share Holdings", icon: Shield },
      { href: "/dashboard/members/cards", label: "Charges and Fees", icon: Shield },

    ],
  },

  {
    label: "Accounting",
    icon: Banknote,
    children: [
      { href: "/dashboard/members", label: "Expenditures", icon: Users },
      { href: "/dashboard/members/add", label: "Budget", icon: Shield },
      { href: "/dashboard/members/cards", label: "Procurement", icon: Shield },
      { href: "/dashboard/members/cards", label: "Reversals & Corrections", icon: Shield },
      { href: "/dashboard/members/cards", label: "General Ledger", icon: Shield },

    ],
  },

  {
    label: "Reporting",
    icon: LineChart,
    children: [
      { href: "/dashboard/members", label: "Document Generation", icon: Users },
      { href: "/dashboard/financial-reports", label: "Financial Reports", icon: Shield },
      { href: "/dashboard/members/register", label: "Member Register", icon: Shield },
      { href: "/dashboard/members/statements", label: "Member Statements", icon: Shield },
      { href: "/dashboard/loans", label: "Loan portfolio", icon: Shield },
      { href: "/dashboard/members/cards", label: "Loan defaulters", icon: Shield },
      { href: "/dashboard/members/cards", label: "Savings Accounts", icon: Shield },
      { href: "/dashboard/members/cards", label: "Share Holdings", icon: Shield },
      { href: "/dashboard/members/cards", label: "General Ledger", icon: Shield },
      { href: "/dashboard/members/cards", label: "Expenditures", icon: Shield },

    ],
  },

    {
    label: "Communication",
    icon: MessageCircle ,
    children: [
      { href: "/dashboard/members", label: "Document Generation", icon: Users },
      { href: "/dashboard/financial-reports", label: "Financial Reports", icon: Shield },
      { href: "/dashboard/members/register", label: "Member Register", icon: Shield },
   

    ],
  },

  {
    label: "Security and Admin",
    icon: Fingerprint,
    children: [
      { href: "/dashboard/members", label: "Users & Roles", icon: Users },
      { href: "/dashboard/members/add", label: "Security & Audit", icon: Shield },


    ],
  },

];

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(() =>
    // auto-open a parent if the current route is inside it
    links
      .filter((l) => l.children?.some((c) => pathname.startsWith(c.href)))
      .map((l) => l.label)
  );

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (

    <div>
    <aside
      className={`h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white transition-all duration-200 ${collapsed ? "w-16" : "w-64"
        }`}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
        {!collapsed && <span className="font-semibold text-gray-900">saccofx <span className="text-orange-400">pro.</span></span>}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {links.map((item) => {
          const Icon = item.icon;

          // Leaf item (no children) — plain link
          if (!item.children) {
            const pathname = usePathname() ?? "";
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href!}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          }

          // Parent item with dropdown children
          const isOpen = openMenus.includes(item.label);
          const pathname = usePathname() ?? "";
          const childActive = item.children.some((c) => pathname.startsWith(c.href));

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleMenu(item.label)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${childActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </span>
                {!collapsed && (
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                      }`}
                  />
                )}
              </button>

              {/* Submenu */}
              {!collapsed && (
                <div
                  className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                >
                  <div className="ml-4 mt-1 pl-3 border-l border-gray-200 space-y-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${active
                              ? "bg-gray-900 text-white"
                              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                        >
                          <ChildIcon size={15} className="shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>

    <div className="text-white text-3xl">
HELLO
    </div>
    </div>
  );
}