/* Průvodce kroky kalkulačky.
   Na tmavém webu to dělal js/main.js. Sem se přenesly jen výpočty,
   takže tlačítko „Dále" přepočítalo výkaz a panel nechalo na místě.
   Tenhle soubor jen přepíná panely a, když v aktuálním kroku chybí
   údaj, řekne který. Výpočet nechává kalkulačkám. */
(function () {
  function start() {
    var wizard = document.getElementById("calc-wizard");
    if (!wizard || wizard.getAttribute("data-wizard-ready") === "1") return;
    wizard.setAttribute("data-wizard-ready", "1");

    var steps = wizard.querySelectorAll(".wizard-step");
    var panels = wizard.querySelectorAll(".wizard-panel");
    var fill = wizard.querySelector(".progress-fill");
    var current = 0;
    var hlaska = document.createElement("div");
    hlaska.id = "wizard-chyba";
    hlaska.setAttribute("role", "alert");
    hlaska.hidden = true;
    wizard.insertBefore(hlaska, wizard.firstChild);

    function ukaz(text) {
      if (!text) {
        hlaska.hidden = true;
        hlaska.textContent = "";
        return;
      }
      hlaska.hidden = false;
      hlaska.textContent = text;
    }

    function goTo(idx) {
      if (idx < 0 || idx >= panels.length) return;
      steps.forEach(function (s, i) {
        s.classList.toggle("active", i === idx);
        s.classList.toggle("done", i < idx);
      });
      panels.forEach(function (p, i) {
        p.classList.toggle("active", i === idx);
      });
      if (fill) fill.style.width = ((idx + 1) / panels.length * 100) + "%";
      current = idx;
      ukaz("");
    }

    function popisek(el) {
      if (el.id) {
        var primo = wizard.querySelector('label[for="' + el.id + '"]');
        if (primo) return primo.textContent.replace(/\s+/g, " ").replace(/\*+/g, "").trim();
      }
      var skupina = el.closest(".wizard-field-group");
      var label = skupina && skupina.querySelector(".wizard-label");
      if (label) return label.textContent.replace(/\s+/g, " ").replace(/\*+/g, "").trim();
      return "povinné pole";
    }

    function viditelne(el) {
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function hlidane(el) {
      if (el.required) return true;
      if (el.id && el.id.indexOf("w-dim-") === 0) return true;
      return ["w-sklon", "w-okap", "w-stit", "w-presah", "w-km"].indexOf(el.id) >= 0;
    }

    /* Volitelný opis s_k z mapy zůstává prázdný — oblast je vybraná v seznamu. */
    function volitelne(el) {
      return el.id === "w-sk";
    }

    function chybejici(panel) {
      var nalezene = [];
      if (!panel) return nalezene;
      var strechy = panel.querySelector("#w-strechy");
      if (strechy && !strechy.querySelector("button")) {
        nalezene.push("tvar střechy (výběr se nenačetl, obnovte stránku)");
      }
      panel.querySelectorAll("input, select, textarea").forEach(function (el) {
        if (el.disabled || el.type === "hidden" || el.type === "radio" || el.type === "checkbox" || el.type === "file") return;
        if (!viditelne(el) || volitelne(el) || !hlidane(el)) return;
        var text = String(el.value || "").trim();
        var nazev = popisek(el);
        if (!text) {
          nalezene.push(nazev);
          return;
        }
        if (el.type === "number") {
          var n = parseFloat(text.replace(",", "."));
          var min = el.min === "" ? null : parseFloat(el.min);
          var max = el.max === "" ? null : parseFloat(el.max);
          if (!isFinite(n) || (min != null && n < min) || (max != null && n > max)) {
            var rozsah = "";
            if (min != null && max != null) rozsah = " (má být mezi " + el.min + " a " + el.max + ")";
            else if (min != null) rozsah = " (nejméně " + el.min + ")";
            else if (max != null) rozsah = " (nejvýš " + el.max + ")";
            nalezene.push(nazev + rozsah);
          }
        }
      });
      return nalezene;
    }

    function ukazVysledek() {
      var result = document.getElementById("calc-result");
      if (!result) return;
      result.classList.add("show");
    }

    var tlacitkaDalsi = wizard.querySelectorAll("[data-wizard-next]");
    var oznaceno = wizard.querySelector("[data-wizard-vysledek]");

    tlacitkaDalsi.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var panel = btn.closest(".wizard-panel");
        var chybi = chybejici(panel);
        if (chybi.length) {
          e.preventDefault();
          e.stopImmediatePropagation();
          ukaz("Než půjdete dál, doplňte: " + chybi.join(", ") + ".");
          hlaska.scrollIntoView({ block: "nearest" });
          return;
        }
        var jeTo = oznaceno
          ? btn.hasAttribute("data-wizard-vysledek")
          : current === panels.length - 2;
        if (jeTo) ukazVysledek();
        goTo(current + 1);
      }, true);
    });

    wizard.querySelectorAll("[data-wizard-prev]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goTo(current - 1);
      });
    });

    steps.forEach(function (s, i) {
      s.addEventListener("click", function () {
        if (i <= current) goTo(i);
      });
    });

    goTo(0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
