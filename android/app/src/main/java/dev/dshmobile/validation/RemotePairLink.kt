package dev.dshmobile.validation

import java.net.URI
import java.net.URLDecoder
import okhttp3.HttpUrl.Companion.toHttpUrl

/** 仅解析配对材料，不联网、不创建身份；key 始终留在 fragment 中。 */
internal class RemotePairLink private constructor(val canonical: String, val origin: String) {
    companion object {
        fun parse(raw: String): RemotePairLink? = runCatching {
            require(raw.length in 1..4096 && raw.none { it.isWhitespace() || it.isISOControl() })
            val value = URI(raw)
            val fragment = value.rawFragment.orEmpty()
            require(fragment.matches(Regex("key=[A-Za-z0-9_-]{43}")))
            val server = if (value.scheme == "dshm") {
                require(value.rawAuthority == "pair" && value.rawPath.isEmpty())
                val query = value.rawQuery.orEmpty()
                require(query.startsWith("server=") && !query.contains('&') && !query.contains('+'))
                URI(URLDecoder.decode(query.substring(7), "UTF-8")).also {
                    require(it.rawPath in listOf("", "/") && it.rawQuery == null && it.rawFragment == null)
                }
            } else {
                require(value.rawPath == "/pair" && value.rawQuery == null)
                value
            }
            require(server.scheme in setOf("http", "https") && !server.host.isNullOrEmpty() && server.rawUserInfo == null)
            require(server.port == -1 || server.port in 1..65535)
            val origin = URI(server.scheme, null, server.host, server.port, null, null, null).toString().toHttpUrl().toString().removeSuffix("/")
            RemotePairLink("$origin/pair#$fragment", origin)
        }.getOrNull()
    }
}
