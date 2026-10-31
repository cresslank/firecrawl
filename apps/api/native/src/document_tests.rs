use super::convert_document_to_markdown;
use std::io::{Cursor, Write};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

const DOCX: &[u8] = include_bytes!("../../samples/sample.docx");
const XLSX: &[u8] = include_bytes!("../../samples/sample.xlsx");
const ODT: &[u8] = include_bytes!("../../samples/sample.odt");

// Real ZIP containers and parsers: no extension hint on the success paths.
fn archive(parts: &[(&str, &str)]) -> Vec<u8> {
  let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
  for (name, contents) in parts {
    let method = if *name == "mimetype" {
      CompressionMethod::Stored
    } else {
      CompressionMethod::Deflated
    };
    writer
      .start_file(
        *name,
        SimpleFileOptions::default().compression_method(method),
      )
      .unwrap();
    writer.write_all(contents.as_bytes()).unwrap();
  }
  writer.finish().unwrap().into_inner()
}

fn expected_sample(format: &str) -> String {
  format!(
    "**Hello!**\n\n{format} file to test the Firecrawl Document Converter.\n\n*Italic*\n\n**Bold**\n\nUnderlined\n\n~~Strikethrough~~\n\n| Header 1 | Header 2 |\n| --- | --- |\n| Value 1 | Value 2 |\n"
  )
}

#[test]
fn converts_docx_sample() {
  assert_eq!(
    convert_document_to_markdown(DOCX, None).unwrap(),
    expected_sample("DOCX")
  );
}

#[test]
fn converts_odt_sample() {
  assert_eq!(
    convert_document_to_markdown(ODT, None).unwrap(),
    expected_sample("ODT")
  );
}

#[test]
fn converts_xlsx_sample() {
  assert_eq!(
    convert_document_to_markdown(XLSX, None).unwrap(),
    "## Sheet1\n\n| sample file | test |\n| --- | --- |\n|  |  |\n| Name | Price |\n| iPhone | 1000 |\n| iPad | 800 |\n| Macbook | 1200 |\n\n## Sheet2\n\n|  |  |\n| --- | --- |\n| other tab |  |\n|  |  |\n| Name | Price |\n| ChatGPT | $20.00 |\n| Claude | $17.00 |\n| Perplexity | $20.00 |\n"
  );
}

fn pptx() -> Vec<u8> {
  archive(&[
    (
      "ppt/presentation.xml",
      r#"<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>"#,
    ),
    (
      "ppt/_rels/presentation.xml.rels",
      r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>"#,
    ),
    (
      "ppt/slides/slide1.xml",
      r#"<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>PPTX zip compatibility</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>"#,
    ),
  ])
}

#[test]
fn converts_deflated_pptx_slide() {
  assert_eq!(
    convert_document_to_markdown(&pptx(), None).unwrap(),
    "PPTX zip compatibility\n"
  );
}

fn epub() -> Vec<u8> {
  archive(&[
    ("mimetype", "application/epub+zip"),
    (
      "META-INF/container.xml",
      r#"<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#,
    ),
    (
      "book/content.opf",
      r#"<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>"#,
    ),
    (
      "book/chapter.xhtml",
      r#"<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Zip test</title></head><body><p>EPUB zip compatibility</p></body></html>"#,
    ),
  ])
}

#[test]
fn converts_epub_stored_mimetype_and_deflated_chapter() {
  assert_eq!(
    convert_document_to_markdown(&epub(), None).unwrap(),
    "EPUB zip compatibility\n"
  );
}

#[test]
fn preserves_docx_header_footer_hardening() {
  let data = archive(&[
    (
      "word/document.xml",
      r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Document body</w:t></w:r></w:p><w:sectPr><w:headerReference r:id="header"/><w:headerReference r:id="header"/><w:headerReference r:id="external"/><w:footerReference r:id="footer"/></w:sectPr></w:body></w:document>"#,
    ),
    (
      "word/_rels/document.xml.rels",
      r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="untrusted.xml" TargetMode="External"/><Relationship Id="footer" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>"#,
    ),
    (
      "word/header1.xml",
      r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Trusted header</w:t></w:r></w:p></w:hdr>"#,
    ),
    (
      "word/footer1.xml",
      r#"<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Trusted footer</w:t></w:r></w:p></w:ftr>"#,
    ),
    (
      "word/untrusted.xml",
      r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Untrusted header</w:t></w:r></w:p></w:hdr>"#,
    ),
  ]);
  assert_eq!(
    convert_document_to_markdown(&data, None).unwrap(),
    "Trusted header\n\nDocument body\n\nTrusted footer\n"
  );
}

#[test]
fn rejects_truncated_zip_documents_even_with_extension_hints() {
  let slides = pptx();
  let book = epub();
  for (ext, data) in [
    ("docx", DOCX),
    ("xlsx", XLSX),
    ("odt", ODT),
    ("pptx", slides.as_slice()),
    ("epub", book.as_slice()),
  ] {
    assert!(
      convert_document_to_markdown(&data[..data.len() / 2], Some(ext.to_string())).is_err(),
      "truncated {ext} must not produce successful markdown"
    );
  }
}

#[test]
fn rejects_zip_without_supported_document_parts() {
  assert!(
    convert_document_to_markdown(&archive(&[("readme.txt", "not a document")]), None).is_err()
  );
}
