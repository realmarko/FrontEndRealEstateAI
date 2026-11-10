// CloudFront Function (viewer-request) for the frontend's S3+CloudFront dev/prod distributions.
//
// The Angular build prerenders one static page per route (for-agents/index.html,
// agents/index.html, etc.) rather than a single SPA shell — so a direct request for
// "/for-agents" must resolve to the key "for-agents/index.html" in the private S3 origin.
// Without this rewrite, S3 (behind the OAC, no ListBucket) returns 403 for the non-existent
// exact key "for-agents", and the distribution's 403->/index.html custom error response serves
// the HOME page's prerendered HTML instead — wrong content on every direct link, browser
// refresh, or crawler request to anything but the root.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Asset requests (styles-XXXX.css, main-XXXX.js, sitemap.xml, ...) already name a real object.
  if (uri.includes('.')) {
    return request;
  }

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else {
    request.uri = uri + '/index.html';
  }

  return request;
}
