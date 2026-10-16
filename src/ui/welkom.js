// Welkomstscherm: de eerste keer dat je de app opent, en via de ?-knop rechtsboven.

export function welkomScherm() {
  return `
    <div class="welkom-achter">
      <section class="welkom" role="dialog" aria-modal="true" aria-labelledby="welkom-titel">
        <h2 id="welkom-titel">Welkom bij Boodschappenroute</h2>
        <p>Plan je boodschappen voor de Jumbo Zwolle Stadshagen en loop daarna de kortste route door de winkel.</p>
        <ol class="welkom-stappen">
          <li><strong>Acties</strong> <span class="zacht">(mag je overslaan)</span><br>Vul de aanbiedingen uit de folder in. Maaltijden met acties krijgen voorrang.</li>
          <li><strong>Menu</strong><br>Laat een weekmenu maken binnen je budget en zet het met één tik op je lijst.</li>
          <li><strong>Lijst</strong><br>Vul aan met wat je verder nodig hebt.</li>
          <li><strong>Route en Kaart</strong><br>Loop in de winkel de kortste route en vink af. Ligt iets er niet? Tik op <em>Ligt er niet</em>.</li>
        </ol>
        <div class="knoppen">
          <button class="knop" data-actie="welkom-menu">Maak een weekmenu</button>
          <button class="knop stil" data-actie="welkom-lijst">Meteen een lijst maken</button>
        </div>
      </section>
    </div>`;
}
