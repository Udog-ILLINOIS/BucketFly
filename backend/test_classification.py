"""
Test Classification Script — Cat Vision-Inspect

Tests the AI's ability to classify component images into:
  RED, YELLOW, GREEN, or FAIL

Runs against:
  1. Labeled training images (to verify accuracy on known data)
  2. Test images from data/ root (to evaluate on unseen data)
  3. False positive images (to verify they're correctly classified as GREEN)

Usage:
  python test_classification.py              # Run all tests
  python test_classification.py --test-only  # Only run test images (data/ root)
  python test_classification.py --train-only # Only validate against training labels
  python test_classification.py --fp-only    # Only test false positives
"""

import os
import sys
import json
import time
import base64
import argparse
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(__file__))
load_dotenv()

from services.training_data import (
    TRAINING_CATALOG,
    load_training_image_b64,
    get_test_images,
    DATA_DIR,
)


def get_ai_service():
    """Initialize the AI service (Gemini primary, Claude fallback)."""
    try:
        from services.gemini_service import GeminiService
        service = GeminiService()
        print(f"[TEST] Using Gemini service")
        return service, "gemini"
    except Exception as e:
        print(f"[TEST] Gemini unavailable ({e}), trying Claude...")
        try:
            from services.claude_service import ClaudeService
            service = ClaudeService()
            print(f"[TEST] Using Claude service")
            return service, "claude"
        except Exception as e2:
            print(f"[ERROR] Neither Gemini nor Claude available: {e2}")
            sys.exit(1)


def classify_single_image(service, image_b64: str, use_few_shot: bool = True) -> dict:
    """
    Run visual analysis on a single image and extract the classification.
    Returns the full analysis result.
    """
    # Strip data URI prefix if present
    if ',' in image_b64:
        image_b64 = image_b64.split(',')[1]

    result = service.analyze_frames([image_b64], use_few_shot=use_few_shot)
    return result


def extract_grade(result: dict) -> str:
    """Extract the color-code grade from an analysis result."""
    # Try the new color_code field first
    grade = result.get("color_code", "")
    if grade:
        return grade

    # Fallback: infer from preliminary_status
    status = result.get("preliminary_status", "UNCLEAR")
    if status == "PASS":
        return "Green"
    elif status == "MONITOR":
        return "Yellow"
    elif status == "FAIL":
        return "Red"
    else:
        return "Fail"


def print_result(filename: str, expected: str, actual: str, confidence: float, component: str, reasoning: str):
    """Pretty-print a classification result."""
    match = "✓" if expected.lower() == actual.lower() else "✗"
    color_indicator = {
        "green": "🟢", "yellow": "🟡", "red": "🔴", "fail": "⚪"
    }.get(actual.lower(), "❓")

    print(f"\n  {match} {filename}")
    print(f"    Expected: {expected.upper()} | Actual: {color_indicator} {actual.upper()} | Confidence: {confidence:.2f}")
    print(f"    Component: {component}")
    if reasoning:
        # Truncate long reasoning for readability
        if len(reasoning) > 200:
            reasoning = reasoning[:200] + "..."
        print(f"    Reasoning: {reasoning}")


def run_training_validation(service, delay: float = 2.0):
    """Validate against known RED and YELLOW training images."""
    print("\n" + "=" * 70)
    print("  TRAINING DATA VALIDATION")
    print("  Testing against labeled Red and Yellow images")
    print("=" * 70)

    results = []

    # Test RED images
    print("\n  --- RED (expected: Red) ---")
    for entry in TRAINING_CATALOG["red"]:
        b64 = load_training_image_b64("Red", entry["filename"])
        if not b64:
            print(f"  [SKIP] {entry['filename']} - image not found")
            continue

        try:
            result = classify_single_image(service, b64)
            grade = extract_grade(result)
            confidence = result.get("confidence", 0.0)
            component = result.get("component", "Unknown")
            reasoning = result.get("chain_of_thought", {}).get("conclusion", "")

            print_result(entry["filename"], "Red", grade, confidence, component, reasoning)
            results.append({
                "filename": entry["filename"],
                "expected": "Red",
                "actual": grade,
                "correct": grade.lower() == "red",
                "confidence": confidence,
            })
        except Exception as e:
            print(f"  [ERROR] {entry['filename']}: {e}")
            results.append({"filename": entry["filename"], "expected": "Red", "actual": "ERROR", "correct": False})

        time.sleep(delay)

    # Test YELLOW images
    print("\n  --- YELLOW (expected: Yellow) ---")
    for entry in TRAINING_CATALOG["yellow"]:
        b64 = load_training_image_b64("Yellow", entry["filename"])
        if not b64:
            print(f"  [SKIP] {entry['filename']} - image not found")
            continue

        try:
            result = classify_single_image(service, b64)
            grade = extract_grade(result)
            confidence = result.get("confidence", 0.0)
            component = result.get("component", "Unknown")
            reasoning = result.get("chain_of_thought", {}).get("conclusion", "")

            print_result(entry["filename"], "Yellow", grade, confidence, component, reasoning)
            results.append({
                "filename": entry["filename"],
                "expected": "Yellow",
                "actual": grade,
                "correct": grade.lower() == "yellow",
                "confidence": confidence,
            })
        except Exception as e:
            print(f"  [ERROR] {entry['filename']}: {e}")
            results.append({"filename": entry["filename"], "expected": "Yellow", "actual": "ERROR", "correct": False})

        time.sleep(delay)

    return results


def run_false_positive_test(service, delay: float = 2.0):
    """Test that previously false-positive images are now correctly classified as GREEN."""
    print("\n" + "=" * 70)
    print("  FALSE POSITIVE CORRECTION TEST")
    print("  These images were wrongly flagged — they should be GREEN")
    print("=" * 70)

    results = []

    for entry in TRAINING_CATALOG["false_positives_actually_green"]:
        b64 = load_training_image_b64("Failed Prompts", entry["filename"])
        if not b64:
            print(f"  [SKIP] {entry['filename']} - image not found")
            continue

        try:
            result = classify_single_image(service, b64)
            grade = extract_grade(result)
            confidence = result.get("confidence", 0.0)
            component = result.get("component", "Unknown")
            reasoning = result.get("chain_of_thought", {}).get("conclusion", "")

            print_result(entry["filename"], "Green", grade, confidence, component, reasoning)
            results.append({
                "filename": entry["filename"],
                "expected": "Green",
                "actual": grade,
                "correct": grade.lower() == "green",
                "confidence": confidence,
                "ai_previous_mistake": entry["ai_mistake"],
            })
        except Exception as e:
            print(f"  [ERROR] {entry['filename']}: {e}")
            results.append({"filename": entry["filename"], "expected": "Green", "actual": "ERROR", "correct": False})

        time.sleep(delay)

    return results


def run_test_images(service, delay: float = 2.0):
    """Run classification on the unlabeled test images in data/ root."""
    print("\n" + "=" * 70)
    print("  TEST IMAGE CLASSIFICATION")
    print("  These are unlabeled images — see how the AI classifies them")
    print("=" * 70)

    test_images = get_test_images()
    if not test_images:
        print("  No test images found in data/ root")
        return []

    results = []

    for img in test_images:
        try:
            result = classify_single_image(service, img["image_b64"])
            grade = extract_grade(result)
            confidence = result.get("confidence", 0.0)
            component = result.get("component", "Unknown")
            reasoning = result.get("chain_of_thought", {}).get("conclusion", "")
            status = result.get("preliminary_status", "UNCLEAR")

            color_indicator = {
                "green": "🟢", "yellow": "🟡", "red": "🔴", "fail": "⚪"
            }.get(grade.lower(), "❓")

            print(f"\n  {img['filename']}")
            print(f"    Grade: {color_indicator} {grade.upper()} | Status: {status} | Confidence: {confidence:.2f}")
            print(f"    Component: {component}")
            if reasoning:
                if len(reasoning) > 200:
                    reasoning = reasoning[:200] + "..."
                print(f"    Reasoning: {reasoning}")

            results.append({
                "filename": img["filename"],
                "grade": grade,
                "status": status,
                "confidence": confidence,
                "component": component,
                "reasoning": result.get("chain_of_thought", {}).get("conclusion", ""),
            })
        except Exception as e:
            print(f"  [ERROR] {img['filename']}: {e}")
            results.append({"filename": img["filename"], "grade": "ERROR", "error": str(e)})

        time.sleep(delay)

    return results


def print_summary(training_results, fp_results, test_results):
    """Print final summary of all test runs."""
    print("\n" + "=" * 70)
    print("  CLASSIFICATION TEST SUMMARY")
    print("=" * 70)

    if training_results:
        correct = sum(1 for r in training_results if r.get("correct"))
        total = len(training_results)
        print(f"\n  Training Validation: {correct}/{total} correct ({100*correct/total:.0f}%)")
        for r in training_results:
            mark = "✓" if r.get("correct") else "✗"
            print(f"    {mark} {r['filename']}: expected {r['expected']}, got {r['actual']}")

    if fp_results:
        correct = sum(1 for r in fp_results if r.get("correct"))
        total = len(fp_results)
        print(f"\n  False Positive Correction: {correct}/{total} now correct ({100*correct/total:.0f}%)")
        for r in fp_results:
            mark = "✓" if r.get("correct") else "✗"
            print(f"    {mark} {r['filename']}: expected Green, got {r['actual']}")

    if test_results:
        print(f"\n  Test Image Classifications: {len(test_results)} images")
        grade_counts = {}
        for r in test_results:
            g = r.get("grade", "ERROR")
            grade_counts[g] = grade_counts.get(g, 0) + 1
        for grade, count in sorted(grade_counts.items()):
            indicator = {"Green": "🟢", "Yellow": "🟡", "Red": "🔴", "Fail": "⚪"}.get(grade, "❓")
            print(f"    {indicator} {grade}: {count}")

    print("\n" + "=" * 70)


def save_results(training_results, fp_results, test_results):
    """Save all results to a JSON file for review."""
    output = {
        "timestamp": datetime.now().isoformat(),
        "training_validation": training_results,
        "false_positive_correction": fp_results,
        "test_classifications": test_results,
    }

    output_path = os.path.join(os.path.dirname(__file__), "classification_test_results.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Results saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Test AI image classification")
    parser.add_argument("--test-only", action="store_true", help="Only test unlabeled images")
    parser.add_argument("--train-only", action="store_true", help="Only validate against training labels")
    parser.add_argument("--fp-only", action="store_true", help="Only test false positives")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between API calls (seconds)")
    parser.add_argument("--no-few-shot", action="store_true", help="Disable few-shot training images in prompt")
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("  CAT VISION-INSPECT — Classification Test Suite")
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Data directory: {DATA_DIR}")
    print("=" * 70)

    service, service_name = get_ai_service()

    training_results = []
    fp_results = []
    test_results = []

    run_all = not (args.test_only or args.train_only or args.fp_only)

    if run_all or args.train_only:
        training_results = run_training_validation(service, delay=args.delay)

    if run_all or args.fp_only:
        fp_results = run_false_positive_test(service, delay=args.delay)

    if run_all or args.test_only:
        test_results = run_test_images(service, delay=args.delay)

    print_summary(training_results, fp_results, test_results)
    save_results(training_results, fp_results, test_results)


if __name__ == "__main__":
    main()
