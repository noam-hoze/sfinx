const UserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch("https://jsonplaceholder.typicode.com/users")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch users");
                return res.json();
            })
            .then((data) => setUsers(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p style={{ color: "red" }}>{error}</p>;

    return (
        <div>
            <h2>User List</h2>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {users.map((user) => (
                    <li key={user.id} style={{ margin: "8px 0" }}>
                        <strong>{user.name}</strong> – {user.email}
                    </li>
                ))}
            </ul>
        </div>
    );
};

render(UserList);
