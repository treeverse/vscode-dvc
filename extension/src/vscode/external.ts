import { env, ProviderResult, Uri, window } from 'vscode'

export const openUrl = (url: string) => env.openExternal(Uri.parse(url))

export const getCallBackUrl = async (path: string) => {
  const uri = await env.asExternalUri(
    Uri.parse(`${env.uriScheme}://lakefs.lakefs-dvc${path}`)
  )

  return uri.toString()
}

export const waitForUriResponse = (path: string, onResponse: () => unknown) =>
  window.registerUriHandler({
    handleUri(uri: Uri): ProviderResult<void> {
      if (uri.path === path) {
        onResponse()
      }
    }
  })
