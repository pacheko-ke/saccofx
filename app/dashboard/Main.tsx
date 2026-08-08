import {
    Users,
    DollarSign,
    Activity,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";

export default function Main() {
    const stats = [
        {
            label: "Share Capital",
            value: "KES 48290",
            change: "+12.4%",
            trend: "up",
            icon: DollarSign,
        },
        {
            label: "Active Members",
            value: "834",
            change: "+4.2%",
            trend: "up",
            icon: Users,
        },
        {
            label: "Active Loans",
            value: "312",
            change: "-2.1%",
            trend: "down",
            icon: TrendingUp,
        },
        {
            label: "Total Savings",
            value: "999778.02",
            change: "+0.02%",
            trend: "up",
            icon: Activity,
        },
    ];

    const activity = [
        { user: "Mary", action: "approved loan LN1234", time: "2m ago" },
        { user: "Samuel", action: "added a new member", time: "18m ago" },
        { user: "Geoffrey", action: "declined loan application", time: "1h ago" },
        
    ];

    const recentOrders = [
        { id: "#3921", customer: "Patrick", amount: "$1,240.00", status: "Active" },
        { id: "#3920", customer: "Joshua", amount: "$890.00", status: "Pending" },
        { id: "#3919", customer: "Janet", amount: "$2,150.00", status: "Active" },
        { id: "#3918", customer: "Maria", amount: "$430.00", status: "Active" },
    ];

    const statusStyles: Record<string, string> = {
        Active: "bg-green-50 text-green-700",
        Pending: "bg-amber-50 text-amber-700",
        Suspended: "bg-red-50 text-red-700",
    };
    return (

        <div className="space-y-6 w-full  ml:0 mt-14 md:ml-14 bg-white px-4 md:h-screen">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Here's an overview of your SACCO operations.
                </p>
            </div>

            {/* Stat cards */}
            <div className=" flex flex-col md:flex-row gap-y-4 md:gap-x-4">
                {stats.map(({ label, value, change, trend, icon: Icon }) => (
                    <div
                        key={label}
                        className="bg-white md:w-1/4 border border-gray-200 rounded-xl p-5"
                    >
                        <div className="flex   items-center justify-between">
                            <span className="text-sm text-gray-500">{label}</span>
                            <div className="p-2 rounded-lg bg-gray-50">
                                <Icon size={16} className="text-gray-500" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-end justify-between">
                            <span className="text-2xl font-semibold text-gray-900">
                                {value}
                            </span>
                            <span
                                className={`flex items-center gap-0.5 text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-600"
                                    }`}
                            >
                                {trend === "up" ? (
                                    <ArrowUpRight size={14} />
                                ) : (
                                    <ArrowDownRight size={14} />
                                )}
                                {change}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main grid: activity + orders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent activity */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">
                        Recent activity
                    </h2>
                    <ul className="space-y-4">
                        {activity.map((item, i) => (
                            <li key={i} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                                    {item.user
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-gray-800">
                                        <span className="font-medium">{item.user}</span>{" "}
                                        {item.action}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Recent orders table */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Recent Members
                        </h2>
                        <button className="text-xs font-medium text-gray-500 hover:text-gray-900">
                            View all
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-gray-100">
                                    <th className="font-medium pb-2">Member ID</th>
                                    <th className="font-medium pb-2">Name</th>
                                    <th className="font-medium pb-2">Amount</th>
                                    <th className="font-medium pb-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="border-b border-gray-50 last:border-0"
                                    >
                                        <td className="py-3 text-gray-500">{order.id}</td>
                                        <td className="py-3 font-medium text-gray-900">
                                            {order.customer}
                                        </td>
                                        <td className="py-3 text-gray-700">{order.amount}</td>
                                        <td className="py-3">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status]
                                                    }`}
                                            >
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

    );
}
