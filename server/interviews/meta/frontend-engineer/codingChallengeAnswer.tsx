import React, { useState, useEffect } from "react";

function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch("https://jsonplaceholder.typicode.com/users")
            .then((r) => r.json())
            .then((d) => {
                setUsers(d);
                setLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <ul>
            {users.map((u) => (
                <li key={u.id}>
                    <strong>{u.name}</strong> - {u.email}
                </li>
            ))}
        </ul>
    );
}

export default UserList;
