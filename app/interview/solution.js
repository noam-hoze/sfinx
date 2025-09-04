// Welcome to your coding interview!
// Start by creating a UserList component that fetches users from an API

const UserList = () => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                "https://jsonplaceholder.typicode.com/users"
            );
            if (!response.ok) {
                throw new Error("Failed to fetch users");
            }
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Loading users...</h2>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4 text-red-600">
                    Error
                </h2>
                <p className="text-gray-600">{error}</p>
                <button
                    onClick={fetchUsers}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">User List</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className="bg-white p-4 rounded-lg shadow-md border"
                    >
                        <h3 className="font-semibold text-lg text-gray-800">
                            {user.name}
                        </h3>
                        <p className="text-gray-600">{user.email}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            {user.company.name}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===== REQUIRED: This render call must be at the end =====
render(UserList);
