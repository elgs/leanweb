const htmlparser2 = require("htmlparser2");
const parser = new htmlparser2.Parser(
   {
      // onopentag(name, attribs) {
      //    console.log('onopentag', name, attribs);
      // },
      onopentagname(name) {
         console.log('onopentagname', name);
      },
      onattribute(name, value) {
         console.log('onattribute', name, value);
      },
      ontext(text) {
         console.log('ontext', text);
      },
      onclosetag(tagname) {
         console.log('onclosetag', tagname);
      },
      onerror(error) {
         console.log('onerror', error);
      }
   },
   { decodeEntities: true, recognizeSelfClosing: true }
);

const html = `<div>
<span class="x" lw>asdf</span>
<span lw-class="a">dddd</span>
</div`;

parser.write(html);
parser.end();