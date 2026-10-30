"""Checkpoint 1: one real Featherless call per model.

    python -m agent.smoke              # real calls (uses the cache after the first time)
    python -m agent.smoke --critic deepseek-ai/DeepSeek-R1-Distill-Qwen-32B
"""
import argparse
import sys
import time

from agent import config, llm


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--generator", default=config.GENERATOR_MODEL)
    ap.add_argument("--critic", default=config.CRITIC_MODEL)
    args = ap.parse_args()

    checks = [
        (args.generator, config.GENERATOR_MAX_TOKENS,
         "Write a Python function add(a, b) that returns a + b. Reply with one ```python code block."),
        (args.critic, config.CRITIC_MAX_TOKENS,
         "In one sentence: why should a different model critique code than the one that wrote it?"),
    ]
    ok = True
    for model, max_tokens, prompt in checks:
        start = time.time()
        try:
            r = llm.chat(model, [{"role": "user", "content": prompt}], max_tokens)
        except llm.LLMError as exc:
            print(f"FAIL {model}: {exc}")
            ok = False
            continue
        print(f"OK   {model}  ({time.time() - start:.1f}s, cached={r['cached']}, tokens={r['tokens']})")
        print(f"     request_hash  {r['request_hash']}")
        print(f"     response_hash {r['response_hash']}")
        print("     " + llm.strip_think(r["text"])[:300].replace("\n", "\n     "))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
