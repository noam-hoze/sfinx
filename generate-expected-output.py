import numpy as np
import hashlib

SR = 16000
N_FFT = 512
HOP = 160
N_MELS = 40
EPS = 1e-10

def make_signal(length_sec=1):
    t = np.arange(SR * length_sec) / SR
    f1, f2 = 440.0, 880.0
    sig = 0.5 * np.sin(2 * np.pi * f1 * t) + 0.3 * np.sin(2 * np.pi * f2 * t)
    noise = 0.02 * np.random.randn(len(sig))
    x = sig + noise
    return x.astype(np.float32)

def hz_to_mel(hz):
    return 2595.0 * np.log10(1.0 + hz / 700.0)

def mel_to_hz(mel):
    return 700.0 * (10 ** (mel / 2595.0) - 1.0)

def stft_magnitude(x, n_fft=N_FFT, hop=HOP):
    x = x.astype(np.float64)
    win = np.hanning(n_fft).astype(np.float64)

    n_frames = 1 + (len(x) - n_fft) // hop
    if n_frames <= 0:
        x = np.pad(x, (0, n_fft - len(x)))
        n_frames = 1

    mags = []
    for i in range(n_frames):
        start = i * hop
        frame = x[start : start + n_fft]
        if len(frame) < n_fft:
            frame = np.pad(frame, (0, n_fft - len(frame)))
        frame = frame * win
        spec = np.fft.rfft(frame, n=n_fft)
        mags.append(np.abs(spec))

    return np.stack(mags, axis=1)

def mel_filterbank(sr=SR, n_fft=N_FFT, n_mels=N_MELS, fmin=0.0, fmax=None):
    if fmax is None:
        fmax = sr / 2

    n_freqs = n_fft // 2 + 1
    mels = np.linspace(hz_to_mel(fmin), hz_to_mel(fmax), n_mels + 2)
    hz = mel_to_hz(mels)
    bins = np.floor((n_fft + 1) * hz / sr).astype(int)

    fb = np.zeros((n_mels, n_freqs), dtype=np.float64)

    for i in range(n_mels):
        left, center, right = bins[i], bins[i + 1], bins[i + 2]
        if center == left:
            center += 1
        if right == center:
            right += 1

        for j in range(left, center):
            if 0 <= j < n_freqs:
                fb[i, j] = (j - left) / (center - left)

        for j in range(center, right):
            if 0 <= j < n_freqs:
                fb[i, j] = (right - j) / (right - center)

    enorm = 2.0 / (hz[2 : n_mels + 2] - hz[0:n_mels])
    fb *= enorm[:, None]
    return fb

def log_mel_spectrogram(x, sr=SR, n_fft=N_FFT, hop=HOP, n_mels=N_MELS, eps=EPS):
    mag = stft_magnitude(x, n_fft=n_fft, hop=hop)
    power = mag ** 2
    fb = mel_filterbank(sr=sr, n_fft=n_fft, n_mels=n_mels)
    mel = fb @ power
    return np.log(mel + eps)

if __name__ == "__main__":
    # Set seed for reproducibility
    np.random.seed(42)

    x = make_signal()
    S = log_mel_spectrogram(x)

    S_round = np.round(S, 6).astype(np.float32)
    digest = hashlib.sha256(S_round.tobytes()).hexdigest()

    print("shape:", S_round.shape)
    print("mean:", float(S_round.mean()))
    print("std:", float(S_round.std()))
    print("sha256:", digest)

    print("\n\nCopy this to expectedOutput in seed-data.ts:")
    print(f"shape: {S_round.shape}")
    print(f"mean: {float(S_round.mean())}")
    print(f"std: {float(S_round.std())}")
    print(f"sha256: {digest}")
