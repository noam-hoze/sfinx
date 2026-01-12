import numpy as np

class QuantumCircuitSimulator:
    def __init__(self, num_qubits=2):
        self.num_qubits = num_qubits
        self.state = np.zeros(2**num_qubits, dtype=complex)
        self.state[0] = 1.0
    
    def hadamard(self, qubit):
        H = np.array([[1, 1], [1, -1]]) / np.sqrt(2)
        self._apply_single_qubit_gate(H, qubit)
        return self
    
    def pauli_x(self, qubit):
        X = np.array([[0, 1], [1, 0]])
        self._apply_single_qubit_gate(X, qubit)
        return self
    
    def _apply_single_qubit_gate(self, gate, target):
        n = self.num_qubits
        full_gate = np.eye(1)
        for i in range(n):
            full_gate = np.kron(full_gate, gate if i == target else np.eye(2))
        self.state = full_gate @ self.state
    
    def measure(self):
        probs = np.abs(self.state)**2
        return np.random.choice(len(self.state), p=probs)
