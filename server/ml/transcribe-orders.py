"""Bounded Indonesian order ASR. Reject loops instead of inventing replacements."""
import json
import os
from pathlib import Path
import re
import sys

os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
ROOT = Path(__file__).resolve().parents[2]


def repetitive(text):
    words = re.findall(r'\w+', text.casefold(), flags=re.UNICODE)
    for width in range(1, 6):
        repeats = 4 if width == 1 else 3
        for start in range(len(words) - width * repeats + 1):
            phrase = words[start:start + width]
            if all(words[start + width * n:start + width * (n + 1)] == phrase for n in range(1, repeats)):
                return True
    return False


def load_model():
    from faster_whisper import WhisperModel
    return WhisperModel(str(ROOT / 'models/speech/whisper-base'), device='cpu', compute_type='int8', cpu_threads=2, num_workers=1, local_files_only=True)


def transcribe(data, model=None):
    # Reuse strict container, duration, mono/resampling and silence bounds.
    from transcribe import decode_bounded, AudioError, RATE
    audio = decode_bounded(data)
    segments, _ = (model or load_model()).transcribe(audio, language='id', task='transcribe', beam_size=3, temperature=0,
        condition_on_previous_text=False, vad_filter=True, vad_parameters={'min_silence_duration_ms': 400},
        no_speech_threshold=0.6, log_prob_threshold=-1.0, compression_ratio_threshold=2.4)
    accepted = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        if repetitive(text) or segment.compression_ratio > 2.4:
            raise AudioError('unreliable_speech')
        if segment.no_speech_prob >= 0.6 or segment.avg_logprob < -1.0:
            # Never silently remove an unclear item/quantity from an order.
            raise AudioError('no_speech')
        accepted.append(text)
    text = ' '.join(accepted).strip()
    if not text:
        raise AudioError('no_speech')
    if repetitive(text):
        raise AudioError('unreliable_speech')
    if len(text) > 2000:
        raise AudioError('too_much_text')
    return {'text': text, 'durationSeconds': round(len(audio) / RATE, 3), 'language': 'id'}


def main():
    try:
        if sys.argv[1:] not in (['base-orders'], ['base-orders', '--check']):
            raise ValueError('Unsupported profile')
        if sys.argv[2:] == ['--check']:
            load_model()
            result = {'ready': True, 'compute': 'cpu-int8'}
        else:
            from transcribe import MAX_BYTES
            result = transcribe(sys.stdin.buffer.read(MAX_BYTES + 1))
        result.update(model='whisper-base', profile='base-orders', openblasThreads='1', pretrained=True)
        print(json.dumps(result, ensure_ascii=True), flush=True)
    except Exception as error:
        code = getattr(error, 'code', 'engine_unavailable')
        print(json.dumps({'error': code}), flush=True)
        sys.exit(3 if code == 'engine_unavailable' else 2)


if __name__ == '__main__':
    main()
