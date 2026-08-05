export default function Login() {

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-left  text-gray-800 mb-6">
                    Login
                </h2>
                <form className="space-y-4">
                    {/* Username */}
                    <div>
                        <label
                            htmlFor="username"
                            className="block text-sm font-medium text-gray-700"
                        >
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="mt-1 block w-full px-3 py-2 border text-black border-gray-300 
                         rounded-md shadow-sm focus:outline-none focus:ring-blue-500 
                         focus:border-blue-500 sm:text-sm"
                            placeholder="Enter your username"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-gray-700"
                        >
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="mt-1 block w-full px-3 py-2 border text-black border-gray-300 
                         rounded-md shadow-sm focus:outline-none focus:ring-blue-500 
                         focus:border-blue-500 sm:text-sm"
                            placeholder="Enter your password"
                        />
                    </div>
                    <p className="text-sm text-gray-600 mt-2"> Forgot Password? Reset</p>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-orange-600 text-white py-2 px-4 rounded-md 
                       hover:bg-orange-700 focus:outline-none focus:ring-2 
                       focus:ring-orange-500 focus:ring-offset-1"
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}



