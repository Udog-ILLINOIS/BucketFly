import requests
import json
import base64
import os

API_URL = "http://localhost:5001/api/analyze"
TEST_IMG = "test_data/worn_bucket_teeth.png"

def test_analyze():
    print(f"Testing {API_URL} with {TEST_IMG}...")
    
    # Read image as base64
    with open(TEST_IMG, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode('utf-8')
        
    frames = [f"data:image/png;base64,{img_b64}"]
    
    # We'll send just frames first to see if it infers purely from visual
    print("Sending POST request...")
    resp = requests.post(API_URL, data={'frames': json.dumps(frames)})
    
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        res_json = resp.json()
        print("\n=== VISUAL ===")
        print(f"Preliminary: {res_json.get('visual_analysis', {}).get('preliminary_status')}")
        print(f"Conclusion: {res_json.get('visual_analysis', {}).get('chain_of_thought', {}).get('conclusion')}")
        
        print("\n=== CROSS-REFERENCE ===")
        cross_ref = res_json.get("cross_reference", {})
        print(f"Mapped Item: {cross_ref.get('checklist_mapped_item')}")
        print(f"Grade: {cross_ref.get('checklist_grade')}")
        print(f"Verdict: {cross_ref.get('verdict_reasoning')}")
        print(f"Final Status: {res_json.get('final_status')}")
        
        # Check assertions
        assert cross_ref.get('checklist_mapped_item') is not None, "Missing mapped item"
        assert cross_ref.get('checklist_grade') in ["Green", "Yellow", "Red"], "Missing/Invalid grade"
        print("\n✅ API Analyze Test Passed!")
    else:
        print("Error:", resp.text)

if __name__ == "__main__":
    test_analyze()
