<script>
  let videoValue = "/" + "videoBox.mp4";
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";

  let value = "";
</script>

<main>
  <section class="header">
    <h1>Fabscription</h1>
    <div class="help">
      <p>
        Scrub video documentation of a fabrication process in lockstep with
        machine instructions and source code.
      </p>
    </div>
  </section>

  <section class="log">
    <div class="section-head">
      <h3>Sketch</h3>
    </div>
    <div>
      <CodeMirror
        bind:value
        lang={javascript()}
        styles={{
          "&": {
            width: "100%",
            maxWidth: "100%",
            height: "100%",
          },
        }}
      />
    </div>
  </section>

  <section class="preview">
    <div class="vid-holder">
      <video controls src={videoValue} />
    </div>
    <div style="text-align: right;padding-top:5px;"></div>
  </section>

  <section class="filters">
    <h3>Machine Instructions</h3>
    <div class="filter-picker"></div>
  </section>
</main>

<style>
  main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "header header"
      "js vid"
      "gc vid";
    grid-template-rows: 20% calc(40% - 40px) calc(40% - 40px);
    padding: 10px;
    grid-gap: 20px;
    height: 100vh;
    align-items: stretch;
  }

  body {
    margin: 0;
    font-family: "Inter", sans-serif;
    color: #0f0f0f;
    margin-bottom: 5%;
  }

  section {
    /* border: 1px solid #999; */
    /* box-shadow: 7px 7px 0px rgba(0, 0, 0, 0.7); */
    border: 3px solid #aeb3f7;
    /* box-shadow: 7px 7px #aeb3f7; */
    padding: 10px;
    background-color: rgb(245, 245, 245);
  }

  .header {
    grid-area: header;
    overflow: scroll;
    display: flex;
    flex-direction: column;
  }

  .preview {
    grid-area: vid;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
  }

  .preview video,
  .preview img {
    width: 100%;
    background-color: #000;
    flex: 1;
  }

  .preview img {
    object-fit: contain;
  }

  .vid-holder {
    flex: 1;
    display: flex;
    width: 100%;
    height: calc(100% - 30px);
  }

  .code-holder {
    flex: 1;
    display: flex;
    width: 100%;
    height: calc(100% - 30px);
  }

  .log {
    grid-area: js;
    display: flex;
    flex-direction: column;
  }

  .filters {
    grid-area: gc;
    display: flex;
    flex-direction: column;
  }

  .section-head {
    display: flex;
    justify-content: stretch;
  }

  .section-head h3 {
    flex: 1;
  }

  .filter-picker {
    /* max-height: 500px; */
    /* width: 400px; */
    top: 0;
    left: 0;
    overflow: scroll;
    background-color: #fff;
  }

  h1,
  h3 {
    font-weight: normal;
    margin: 0;
    padding: 0;
  }

  h1 {
    margin-bottom: 5px;
  }

  h3 {
    margin-bottom: 10px;
  }

  .header p {
    margin: 0;
  }

  .inner-command {
    display: flex;
    align-items: center;
    flex: 1;
  }

  textarea {
    outline: none;
    -webkit-box-shadow: none;
    -moz-box-shadow: none;
    box-shadow: none;
    resize: none;
    height: auto;
    font: inherit;
  }

  .actual-command {
    border: none;
    flex: 1;
    padding: 5px;
    height: 100%;
  }

  .the-log {
    color: red;
    border: none;
    resize: none;
    padding: 5px;
    flex: 1;
  }

  .rendering-video {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0.97;
    background-color: var(--b2);
    z-index: 2;
    top: 0;
    left: 0;
    display: grid;
    align-items: center;
    justify-content: center;
    align-content: center;
  }

  .help {
    font-size: 0.9em;
    flex: 1;
    overflow: scroll;
  }

  ol {
    margin: 5px 0px;
    padding-left: 20px;
  }

  ol li {
    margin-bottom: 5px;
  }

  .graph-holder {
    flex-direction: column;
    display: flex;
    flex: 1;
  }

  .graph-nav {
    display: flex;
    justify-content: space-between;
  }

  @media only screen and (max-width: 1100px) {
    main {
      grid-template-columns: 250px 1fr 1fr 1fr 1fr 300px;
      grid-template-rows: 40px 15% 15% calc(35% - 25px) calc(35% - 40px);
      grid-template-areas:
        "hdr hdr hdr hdr hdr hdr"
        "log log log log prv prv"
        "cmd cmd cmd cmd prv prv"
        "flt gra gra gra gra gra"
        "edt gra gra gra gra gra";
      grid-gap: 7px;
    }

    .header {
      overflow: hidden;
    }

    section {
      padding: 7px;
      box-shadow: 3px 3px 0px var(--b2);
    }
  }

  @media only screen and (max-width: 700px) {
    main {
      grid-template-areas:
        "hdr hdr hdr"
        "cmd cmd cmd"
        "prv prv prv"
        "log log log"
        "flt flt flt"
        "gra gra gra"
        "edt edt edt";
      grid-gap: 0;
      padding: 10px;
      height: auto;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: auto;
    }

    .header {
      overflow: scroll;
      height: auto;
    }

    .graph {
      height: 60vh;
    }

    .command {
      margin: 0;
      margin-bottom: 10px;
    }

    .command,
    .log {
      height: 15vh;
    }

    section {
      box-shadow: none;
      margin-bottom: 10px;
      padding: 10px;
      box-shadow: 2px 2px 0px var(--b2);
    }

    .filter-picker {
      width: 100%;
      margin-bottom: 20px;
      height: 300px;
      position: static;
    }
  }
</style>
