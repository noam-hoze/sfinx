import React, { useState, useEffect } from "react";
function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(
                    "https://jsonplaceholder.typicode.com/users"
                );
                const data = await res.json();
                setUsers(data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    return (
        <ul>
            {" "}
            {users.map((u) => (
                <li key={u.id}>
                    {" "}
                    <strong>{u.name}</strong> - {u.email}{" "}
                </li>
            ))}{" "}
        </ul>
    );
}
export default UserList;
