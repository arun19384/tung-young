package httpadapter

import "testing"

func TestMRTStationValue(t *testing.T) {
	for code, want := range map[string]string{"BL13": "BL13|13", "PP10": "PP10|52", "PP16": "PP16|58"} {
		got, err := mrtStationValue(code)
		if err != nil || got != want {
			t.Fatalf("%s: %q %v", code, got, err)
		}
	}
	if _, err := mrtStationValue("PP99"); err == nil {
		t.Fatal("invalid station accepted")
	}
}

func TestParseMRTFare(t *testing.T) {
	document := `<div>บัตรโดยสาร (บาท) ราคา (บาท) บุคคลทั่วไป 38 นักเรียน นักศึกษา 34</div>`
	got, err := parseMRTFare(document)
	if err != nil || got != 38 {
		t.Fatalf("fare %d %v", got, err)
	}
	if _, err := parseMRTFare("missing"); err == nil {
		t.Fatal("missing fare accepted")
	}
}
