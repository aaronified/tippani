package srcmatch

import "testing"

// The library is not only English: a quote has to be found in the language it was
// written in, whether or not that language uses spaces, vowel signs or optional marks.
func TestAQuoteIsFoundInTheLanguageItWasWrittenIn(t *testing.T) {
	cases := []struct{ name, para, quote string }{
		{"bengali", "আমি বাংলায় গান গাই। আমার মাথা নত করে দাও হে তোমার চরণধুলার তলে। সকল অহংকার হে আমার ডুবাও চোখের জলে।", "আমার মাথা নত করে দাও হে তোমার চরণধুলার তলে"},
		{"bengali, a short quote", "তিনি বললেন, আমি যাব না। তুমি যাও।", "আমি যাব না"},
		{"hindi", "सत्य की हमेशा जीत होती है। जहाँ चाह वहाँ राह। कर्म करो फल की चिंता मत करो।", "कर्म करो फल की चिंता मत करो"},
		{"russian, with and without yo", "Красота спасёт мир, сказал князь Мышкин. Но кто знает, что это значит?", "красота спасет мир"},
		{"french, accents decomposed", "Voila l’ete : ou etes-vous alles, mes tres chers amis ?", "Voila l'e\u0301te\u0301"},
		{"french, accents dropped by the file", "Voilà l’été : où êtes-vous allés, mes très chers amis ?", "Voila l'ete ou etes-vous alles mes tres chers amis"},
		{"arabic, vowel points printed or not", "العلم في الصغر كالنقش على الحجر. مَن جَدَّ وَجَدَ ومن زرع حصد.", "من جد وجد ومن زرع حصد"},
		{"japanese, from inside a sentence", "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。", "生れたかとんと見当"},
		{"chinese, from inside a sentence", "天下大势，分久必合，合久必分。周末七国分争，并入于秦。及秦灭之后，楚、汉分争，又并入于汉。", "七国分争，并入于"},
		{"thai, from inside a sentence", "ความรู้เป็นสิ่งที่มีค่ายิ่งกว่าทรัพย์สมบัติทั้งปวง การศึกษาเป็นกุญแจสู่ความสำเร็จ", "มีค่ายิ่งกว่าทรัพย์สมบัติ"},
	}
	filler := []Unit{{Text: "Lorem ipsum dolor sit amet consectetur."}, {Text: "The quick brown fox jumps over the lazy dog."}}
	for _, c := range cases {
		units := append(append(append([]Unit{}, filler...), Unit{Text: c.para}), filler...)
		r := NewIndex(units).Find(c.quote)
		if !r.Found || r.Match.First != 2 || r.Match.Last != 2 || r.Ambiguous || r.Match.Dist > 1 {
			t.Errorf("%s: %+v", c.name, r)
		}
	}
}

// Vowel signs belong to their word. If they were treated as punctuation, two Bengali
// sentences sharing only their vowel signs would look alike.
func TestAnotherSentenceInTheSameScriptIsNotTheQuote(t *testing.T) {
	ix := NewIndex([]Unit{{Text: "তিনি বললেন, আমি যাব না। তুমি যাও।"}})
	if r := ix.Find("সে জানালো, আমরা খাব না এখন"); r.Found {
		t.Fatalf("matched an unrelated sentence: %+v", r)
	}
}

func TestAMarkThatBelongsToAWordIsKeptAndAnOptionalOneIsDropped(t *testing.T) {
	if Fold("আমি") == Fold("আম") {
		t.Error("a Bengali vowel sign was dropped")
	}
	if Fold("é") != Fold("e\u0301") || Fold("é") != "e" {
		t.Errorf("a combining accent is not the same letter as the precomposed one: %q %q", Fold("é"), Fold("e\u0301"))
	}
}
