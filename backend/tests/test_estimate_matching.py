"""Comprehensive automated tests for the Repair Estimate Checker matching pipeline.

Tests each input line through: normalize → match synonym → fetch classification → validate all fields.
Generates a readable test report at /app/test_reports/matching_pipeline_report.json
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from motor.motor_asyncio import AsyncIOMotorClient
from services.estimate_analyzer import deep_normalize, match_service_key, analyze_estimate_item

VEHICLE = {"make": "Toyota", "model": "Camry", "year": 2020}

TEST_CASES = [
    {
        "input_line_text": "FU03 Fuel Injectors - Clean - REC EVERY16MTH/32K",
        "expected_service_key": "fuel_injector_cleaning",
        "expected_display_name": "Fuel Injector Cleaning",
        "expected_category": "not_required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not part of standard maintenance.",
        "expected_user_explanation": "Consider this only if there are drivability symptoms such as rough idle, misfire, or poor fuel economy."
    },
    {
        "input_line_text": "Fuel Injector Cleaning",
        "expected_service_key": "fuel_injector_cleaning",
        "expected_display_name": "Fuel Injector Cleaning",
        "expected_category": "not_required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not part of standard maintenance.",
        "expected_user_explanation": "Consider this only if there are drivability symptoms such as rough idle, misfire, or poor fuel economy."
    },
    {
        "input_line_text": "Injector Flush",
        "expected_service_key": "fuel_injector_cleaning",
        "expected_display_name": "Fuel Injector Cleaning",
        "expected_category": "not_required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not part of standard maintenance.",
        "expected_user_explanation": "Consider this only if there are drivability symptoms such as rough idle, misfire, or poor fuel economy."
    },
    {
        "input_line_text": "Fuel System Cleaning",
        "expected_service_key": "fuel_injector_cleaning",
        "expected_display_name": "Fuel Injector Cleaning",
        "expected_category": "not_required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not part of standard maintenance.",
        "expected_user_explanation": "Consider this only if there are drivability symptoms such as rough idle, misfire, or poor fuel economy."
    },
    {
        "input_line_text": "BG01 Throttle Body - R&R and Clean",
        "expected_service_key": "throttle_body_cleaning",
        "expected_display_name": "Throttle Body Cleaning",
        "expected_category": "not_required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not part of standard maintenance.",
        "expected_user_explanation": "Throttle body cleaning is generally optional unless there are symptoms such as rough idle or airflow-related drivability issues."
    },
    {
        "input_line_text": "Throttle Service",
        "expected_service_key": "throttle_body_cleaning",
        "expected_display_name": "Throttle Body Cleaning",
        "expected_category": "not_required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not part of standard maintenance.",
        "expected_user_explanation": "Throttle body cleaning is generally optional unless there are symptoms such as rough idle or airflow-related drivability issues."
    },
    {
        "input_line_text": "Brake Fluid Flush - Fluid Dark",
        "expected_service_key": "brake_fluid_flush",
        "expected_display_name": "Brake Fluid Flush",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on age or fluid condition.",
        "expected_user_explanation": "Brake fluid service can be legitimate depending on vehicle age, moisture content, maintenance history, or test results."
    },
    {
        "input_line_text": "Flush Discoloured Brake Fluid",
        "expected_service_key": "brake_fluid_flush",
        "expected_display_name": "Brake Fluid Flush",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on age or fluid condition.",
        "expected_user_explanation": "Brake fluid service can be legitimate depending on vehicle age, moisture content, maintenance history, or test results."
    },
    {
        "input_line_text": "Disc Brake Clean and Lubricate",
        "expected_service_key": "brake_cleaning_lubrication",
        "expected_display_name": "Brake Cleaning and Lubrication",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be useful in harsh climates or during brake service.",
        "expected_user_explanation": "Brake cleaning and lubrication is not always a standard scheduled item, but it can be reasonable in winter or road-salt conditions such as Ontario."
    },
    {
        "input_line_text": "Brake Clean & Lube",
        "expected_service_key": "brake_cleaning_lubrication",
        "expected_display_name": "Brake Cleaning and Lubrication",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be useful in harsh climates or during brake service.",
        "expected_user_explanation": "Brake cleaning and lubrication is not always a standard scheduled item, but it can be reasonable in winter or road-salt conditions such as Ontario."
    },
    {
        "input_line_text": "Battery Service - Corrosion on Negative Terminal",
        "expected_service_key": "battery_terminal_cleaning",
        "expected_display_name": "Battery Terminal Cleaning",
        "expected_category": "conditional",
        "expected_severity": "low",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "Valid if corrosion is present.",
        "expected_user_explanation": "Battery terminal cleaning is a legitimate minor service when corrosion is visible on the battery terminals."
    },
    {
        "input_line_text": "Battery Terminal Cleaning",
        "expected_service_key": "battery_terminal_cleaning",
        "expected_display_name": "Battery Terminal Cleaning",
        "expected_category": "conditional",
        "expected_severity": "low",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "Valid if corrosion is present.",
        "expected_user_explanation": "Battery terminal cleaning is a legitimate minor service when corrosion is visible on the battery terminals."
    },
    {
        "input_line_text": "4 Wheel Alignment",
        "expected_service_key": "wheel_alignment",
        "expected_display_name": "Wheel Alignment",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on symptoms or tire wear.",
        "expected_user_explanation": "Wheel alignment is usually recommended if the vehicle pulls, the steering wheel is off-center, or the tires are wearing unevenly."
    },
    {
        "input_line_text": "Alignment",
        "expected_service_key": "wheel_alignment",
        "expected_display_name": "Wheel Alignment",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on symptoms or tire wear.",
        "expected_user_explanation": "Wheel alignment is usually recommended if the vehicle pulls, the steering wheel is off-center, or the tires are wearing unevenly."
    },
    {
        "input_line_text": "LOF Service",
        "expected_service_key": "engine_oil_change",
        "expected_display_name": "Engine Oil Change",
        "expected_category": "required",
        "expected_severity": "normal",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Standard maintenance item.",
        "expected_user_explanation": "This is typically part of the manufacturer maintenance schedule and is usually appropriate when due by mileage or time."
    },
    {
        "input_line_text": "Oil Change",
        "expected_service_key": "engine_oil_change",
        "expected_display_name": "Engine Oil Change",
        "expected_category": "required",
        "expected_severity": "normal",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Standard maintenance item.",
        "expected_user_explanation": "This is typically part of the manufacturer maintenance schedule and is usually appropriate when due by mileage or time."
    },
    {
        "input_line_text": "Tire Rotate",
        "expected_service_key": "tire_rotation",
        "expected_display_name": "Tire Rotation",
        "expected_category": "required",
        "expected_severity": "normal",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Standard maintenance item.",
        "expected_user_explanation": "Tire rotation is commonly recommended at regular intervals to promote even tire wear."
    },
    {
        "input_line_text": "Cabin Air Filter",
        "expected_service_key": "cabin_air_filter_replacement",
        "expected_display_name": "Cabin Air Filter Replacement",
        "expected_category": "required",
        "expected_severity": "normal",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Common maintenance item.",
        "expected_user_explanation": "Cabin air filter replacement is a normal maintenance service that helps cabin airflow and HVAC performance."
    },
    {
        "input_line_text": "Engine Air Filter",
        "expected_service_key": "engine_air_filter_replacement",
        "expected_display_name": "Engine Air Filter Replacement",
        "expected_category": "required",
        "expected_severity": "normal",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Common maintenance item.",
        "expected_user_explanation": "Engine air filter replacement is a standard maintenance item that helps maintain proper intake airflow."
    },
    {
        "input_line_text": "Spark Plug Replacement",
        "expected_service_key": "spark_plug_replacement",
        "expected_display_name": "Spark Plug Replacement",
        "expected_category": "required",
        "expected_severity": "high",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Standard maintenance item when due.",
        "expected_user_explanation": "Spark plugs are a manufacturer maintenance item, but the mileage interval may vary depending on the engine."
    },
    {
        "input_line_text": "Brake Inspection",
        "expected_service_key": "brake_inspection",
        "expected_display_name": "Brake Inspection",
        "expected_category": "required",
        "expected_severity": "normal",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Legitimate inspection item.",
        "expected_user_explanation": "Brake inspection is a normal and reasonable part of routine maintenance or service visits."
    },
    {
        "input_line_text": "Front Brake Pads",
        "expected_service_key": "brake_pad_replacement",
        "expected_display_name": "Brake Pad Replacement",
        "expected_category": "conditional",
        "expected_severity": "high",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on brake wear.",
        "expected_user_explanation": "Brake pad replacement should be based on actual pad thickness and wear, not just time or mileage alone."
    },
    {
        "input_line_text": "Pads and Rotors",
        "expected_service_key": "brake_rotor_replacement",
        "expected_display_name": "Brake Rotor Replacement",
        "expected_category": "conditional",
        "expected_severity": "high",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on rotor condition.",
        "expected_user_explanation": "Brake rotor replacement is usually justified only when rotors are worn below specification, damaged, or heavily scored."
    },
    {
        "input_line_text": "Battery Replacement",
        "expected_service_key": "battery_replacement",
        "expected_display_name": "Battery Replacement",
        "expected_category": "conditional",
        "expected_severity": "high",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed if battery health test is poor.",
        "expected_user_explanation": "Battery replacement is usually appropriate when a battery test shows weak performance or failure."
    },
    {
        "input_line_text": "Coolant Flush",
        "expected_service_key": "engine_coolant_replacement",
        "expected_display_name": "Engine Coolant Replacement",
        "expected_category": "required",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "recommended_now",
        "expected_recommendation_text": "Standard maintenance item when due.",
        "expected_user_explanation": "Engine coolant replacement is a long-interval maintenance item and should be checked against vehicle age and mileage."
    },
    {
        "input_line_text": "ATF Service",
        "expected_service_key": "transmission_fluid_change",
        "expected_display_name": "Transmission Fluid Change",
        "expected_category": "conditional",
        "expected_severity": "high",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "May be needed depending on vehicle policy, mileage, and transmission type.",
        "expected_user_explanation": "Transmission fluid service can be legitimate, but it should be evaluated using vehicle-specific maintenance guidance and driving conditions."
    },
    {
        "input_line_text": "A/C Recharge",
        "expected_service_key": "ac_recharge",
        "expected_display_name": "AC Refrigerant Recharge",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "Usually symptom-based rather than routine maintenance.",
        "expected_user_explanation": "AC recharge is typically appropriate only when cooling performance is poor and the system has been diagnosed properly."
    },
    {
        "input_line_text": "Premium Oil Additive",
        "expected_service_key": "premium_oil_additive",
        "expected_display_name": "Premium Oil Additive",
        "expected_category": "not_required",
        "expected_severity": "low",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually not necessary.",
        "expected_user_explanation": "Premium oil additives are often upsell items and are usually unnecessary when the correct engine oil is already used."
    },
    {
        "input_line_text": "Fuel Additive",
        "expected_service_key": "fuel_additive",
        "expected_display_name": "Fuel Additive",
        "expected_category": "not_required",
        "expected_severity": "low",
        "expected_default_recommendation_code": "likely_optional",
        "expected_recommendation_text": "Usually optional.",
        "expected_user_explanation": "Fuel additives are commonly sold as optional extras and are generally not part of standard maintenance."
    },
    {
        "input_line_text": "MPI",
        "expected_service_key": "multi_point_inspection",
        "expected_display_name": "Multi-Point Inspection",
        "expected_category": "informational",
        "expected_severity": "low",
        "expected_default_recommendation_code": "cannot_determine",
        "expected_recommendation_text": "Informational inspection item.",
        "expected_user_explanation": "A multi-point inspection is generally useful as supporting information, but by itself it is not a repair recommendation."
    },
    {
        "input_line_text": "Checked for Open Campaign",
        "expected_service_key": "campaign_check",
        "expected_display_name": "Campaign Check",
        "expected_category": "informational",
        "expected_severity": "low",
        "expected_default_recommendation_code": "cannot_determine",
        "expected_recommendation_text": "Informational item.",
        "expected_user_explanation": "Campaign check means the shop looked for open service campaigns or service actions."
    },
    {
        "input_line_text": "TPMS Reset",
        "expected_service_key": "tpms_reset",
        "expected_display_name": "TPMS Reset",
        "expected_category": "informational",
        "expected_severity": "low",
        "expected_default_recommendation_code": "cannot_determine",
        "expected_recommendation_text": "Minor setup/reset item.",
        "expected_user_explanation": "TPMS reset is usually a small supporting action performed during tire service."
    },
    {
        "input_line_text": "Washer Fluid Top Up",
        "expected_service_key": "washer_fluid_topup",
        "expected_display_name": "Washer Fluid Top-Up",
        "expected_category": "informational",
        "expected_severity": "low",
        "expected_default_recommendation_code": "cannot_determine",
        "expected_recommendation_text": "Minor consumable item.",
        "expected_user_explanation": "Washer fluid top-up is a small consumable add-on or bundled service item."
    },
    {
        "input_line_text": "Diagnostic Fee",
        "expected_service_key": "engine_diagnostic",
        "expected_display_name": "Engine Diagnostic Service",
        "expected_category": "conditional",
        "expected_severity": "medium",
        "expected_default_recommendation_code": "maybe_needed",
        "expected_recommendation_text": "Legitimate if there is a warning light or symptom.",
        "expected_user_explanation": "Diagnostic service is usually appropriate when the vehicle has a fault, warning light, or clear drivability issue."
    },
    {
        "input_line_text": "Fuel Rail Pressure Balance Test",
        "expected_service_key": None,
        "expected_display_name": None,
        "expected_category": "unknown",
        "expected_severity": "low",
        "expected_default_recommendation_code": "cannot_determine",
        "expected_recommendation_text": "Service could not be identified.",
        "expected_user_explanation": "Review manually or improve synonym mapping."
    },
    {
        "input_line_text": "Perform Service 3",
        "expected_service_key": None,
        "expected_display_name": None,
        "expected_category": "unknown",
        "expected_severity": "low",
        "expected_default_recommendation_code": "cannot_determine",
        "expected_recommendation_text": "Service could not be identified.",
        "expected_user_explanation": "Review manually or improve synonym mapping."
    },
]


FIELDS_TO_CHECK = [
    ("service_key", "expected_service_key"),
    ("display_name", "expected_display_name"),
    ("category", "expected_category"),
    ("severity", "expected_severity"),
    ("default_recommendation_code", "expected_default_recommendation_code"),
    ("recommendation_text", "expected_recommendation_text"),
    ("user_explanation", "expected_user_explanation"),
]


def _get_db():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return client, client[os.environ.get("DB_NAME", "test_database")]


class TestMatchingPipeline:
    """Parametrized tests for each of the 36 test cases."""

    def _run_case(self, tc):
        async def _inner():
            client, db = _get_db()
            result = await analyze_estimate_item(
                db, tc["input_line_text"], 0.0, VEHICLE
            )
            client.close()
            return result
        return asyncio.run(_inner())

    def test_case_00_fu03_fuel_injector(self):
        self._assert_case(TEST_CASES[0])

    def test_case_01_fuel_injector_cleaning(self):
        self._assert_case(TEST_CASES[1])

    def test_case_02_injector_flush(self):
        self._assert_case(TEST_CASES[2])

    def test_case_03_fuel_system_cleaning(self):
        self._assert_case(TEST_CASES[3])

    def test_case_04_bg01_throttle_body(self):
        self._assert_case(TEST_CASES[4])

    def test_case_05_throttle_service(self):
        self._assert_case(TEST_CASES[5])

    def test_case_06_brake_fluid_flush(self):
        self._assert_case(TEST_CASES[6])

    def test_case_07_flush_discoloured_brake(self):
        self._assert_case(TEST_CASES[7])

    def test_case_08_disc_brake_clean_lubricate(self):
        self._assert_case(TEST_CASES[8])

    def test_case_09_brake_clean_lube(self):
        self._assert_case(TEST_CASES[9])

    def test_case_10_battery_corrosion(self):
        self._assert_case(TEST_CASES[10])

    def test_case_11_battery_terminal(self):
        self._assert_case(TEST_CASES[11])

    def test_case_12_4_wheel_alignment(self):
        self._assert_case(TEST_CASES[12])

    def test_case_13_alignment(self):
        self._assert_case(TEST_CASES[13])

    def test_case_14_lof_service(self):
        self._assert_case(TEST_CASES[14])

    def test_case_15_oil_change(self):
        self._assert_case(TEST_CASES[15])

    def test_case_16_tire_rotate(self):
        self._assert_case(TEST_CASES[16])

    def test_case_17_cabin_air_filter(self):
        self._assert_case(TEST_CASES[17])

    def test_case_18_engine_air_filter(self):
        self._assert_case(TEST_CASES[18])

    def test_case_19_spark_plug(self):
        self._assert_case(TEST_CASES[19])

    def test_case_20_brake_inspection(self):
        self._assert_case(TEST_CASES[20])

    def test_case_21_front_brake_pads(self):
        self._assert_case(TEST_CASES[21])

    def test_case_22_pads_and_rotors(self):
        self._assert_case(TEST_CASES[22])

    def test_case_23_battery_replacement(self):
        self._assert_case(TEST_CASES[23])

    def test_case_24_coolant_flush(self):
        self._assert_case(TEST_CASES[24])

    def test_case_25_atf_service(self):
        self._assert_case(TEST_CASES[25])

    def test_case_26_ac_recharge(self):
        self._assert_case(TEST_CASES[26])

    def test_case_27_premium_oil_additive(self):
        self._assert_case(TEST_CASES[27])

    def test_case_28_fuel_additive(self):
        self._assert_case(TEST_CASES[28])

    def test_case_29_mpi(self):
        self._assert_case(TEST_CASES[29])

    def test_case_30_campaign_check(self):
        self._assert_case(TEST_CASES[30])

    def test_case_31_tpms_reset(self):
        self._assert_case(TEST_CASES[31])

    def test_case_32_washer_fluid(self):
        self._assert_case(TEST_CASES[32])

    def test_case_33_diagnostic_fee(self):
        self._assert_case(TEST_CASES[33])

    def test_case_34_unmatched_fuel_rail(self):
        self._assert_case(TEST_CASES[34])

    def test_case_35_unmatched_perform_service(self):
        self._assert_case(TEST_CASES[35])

    def _assert_case(self, tc):
        result = self._run_case(tc)
        for actual_field, expected_field in FIELDS_TO_CHECK:
            expected = tc[expected_field]
            actual = result.get(actual_field)
            # For unmatched: display_name and recommendation_code can be None
            if expected is None and actual_field in ("display_name",):
                continue
            if expected is None and actual_field == "default_recommendation_code":
                assert actual == "cannot_determine", (
                    f"[{tc['input_line_text']}] {actual_field}: expected cannot_determine, got {actual}"
                )
                continue
            assert actual == expected, (
                f"[{tc['input_line_text']}] {actual_field}: expected '{expected}', got '{actual}'"
            )


def run_report():
    """Generate a readable JSON test report."""
    async def _run():
        client, db = _get_db()
        results = []
        passed = 0
        failed = 0

        for tc in TEST_CASES:
            analysis = await analyze_estimate_item(db, tc["input_line_text"], 0.0, VEHICLE)
            match_result = await match_service_key(db, tc["input_line_text"])
            normalized = deep_normalize(tc["input_line_text"])

            mismatches = []
            for actual_field, expected_field in FIELDS_TO_CHECK:
                expected = tc[expected_field]
                actual = analysis.get(actual_field)
                if expected is None and actual_field in ("display_name",):
                    continue
                if expected is None and actual_field == "default_recommendation_code":
                    if actual != "cannot_determine":
                        mismatches.append({
                            "field": actual_field,
                            "expected": "cannot_determine",
                            "actual": actual
                        })
                    continue
                if actual != expected:
                    mismatches.append({
                        "field": actual_field,
                        "expected": expected,
                        "actual": actual
                    })

            status = "PASS" if not mismatches else "FAIL"
            if status == "PASS":
                passed += 1
            else:
                failed += 1

            results.append({
                "input_line_text": tc["input_line_text"],
                "normalized_text": normalized,
                "matched_synonym": match_result.get("matched_synonym"),
                "match_strategy": match_result.get("match_strategy"),
                "match_confidence": match_result.get("confidence"),
                "actual_service_key": analysis.get("service_key"),
                "expected_service_key": tc["expected_service_key"],
                "status": status,
                "mismatches": mismatches if mismatches else None
            })

        client.close()
        return {
            "report_name": "Matching Pipeline Test Report",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_cases": len(TEST_CASES),
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{passed}/{len(TEST_CASES)} ({round(passed/len(TEST_CASES)*100, 1)}%)",
            "results": results
        }

    return asyncio.run(_run())


if __name__ == "__main__":
    report = run_report()

    os.makedirs("/app/test_reports", exist_ok=True)
    path = "/app/test_reports/matching_pipeline_report.json"
    with open(path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  MATCHING PIPELINE TEST REPORT")
    print(f"  {report['pass_rate']}")
    print(f"{'='*60}\n")

    for r in report["results"]:
        icon = "PASS" if r["status"] == "PASS" else "FAIL"
        print(f"  [{icon}] {r['input_line_text']}")
        print(f"         normalized: {r['normalized_text']}")
        print(f"         matched synonym: {r['matched_synonym']}")
        print(f"         service_key: {r['actual_service_key']} (expected: {r['expected_service_key']})")
        if r["mismatches"]:
            for m in r["mismatches"]:
                print(f"         MISMATCH {m['field']}: got '{m['actual']}', expected '{m['expected']}'")
        print()

    print(f"Report saved to: {path}")
