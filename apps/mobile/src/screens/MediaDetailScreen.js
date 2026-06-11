import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function pickImage(item) {
  const fromItem = Array.isArray(item?.images) ? item.images : [];
  const fromAlbum = Array.isArray(item?.album?.images) ? item.album.images : [];
  const first = [...fromItem, ...fromAlbum][0];
  return first?.url || "";
}

export function MediaDetailScreen({
  mediaType,
  mediaId,
  onLoad,
  onLoadSocial,
  onAddStatus,
  onCreateReview,
  onPatchReview,
  onDeleteReview,
  onLikeReview,
  onAddComment,
}) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [data, setData] = useState(null);
  const [social, setSocial] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [editingReviewId, setEditingReviewId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErrorText("");
      try {
        const [next, socialData] = await Promise.all([
          onLoad({ type: mediaType, id: mediaId }),
          onLoadSocial ? onLoadSocial({ type: mediaType, id: mediaId }) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setData(next);
          setSocial(socialData);
        }
      } catch (e) {
        if (!cancelled) setErrorText(e?.message || "Failed to load media");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [mediaId, mediaType, onLoad, onLoadSocial]);

  const image = pickImage(data);
  const artists = Array.isArray(data?.artists)
    ? data.artists.map((a) => a?.name).filter(Boolean).join(", ")
    : "";
  const genres = Array.isArray(data?.genres) ? data.genres.filter(Boolean).join(", ") : "";
  const summary = social?.summary || {};
  const previewUrl = String(data?.preview_url || "");
  const spotifyUrl = String(data?.external_urls?.spotify || data?.spotify_url || "");

  async function openPlaybackUrl(url, fallbackMessage) {
    if (!url) {
      setErrorText(fallbackMessage);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch (e) {
      setErrorText(e?.message || "Ouverture impossible");
    }
  }

  async function refreshSocial() {
    if (!onLoadSocial) return;
    const next = await onLoadSocial({ type: mediaType, id: mediaId });
    setSocial(next);
  }

  async function addStatus(status) {
    if (!onAddStatus || busyAction) return;
    setBusyAction(true);
    setErrorText("");
    try {
      await onAddStatus(status, { media_type: mediaType, media_id: mediaId });
    } catch (e) {
      setErrorText(e?.message || "Ajout au statut impossible");
    } finally {
      setBusyAction(false);
    }
  }

  async function submitReview() {
    if ((!editingReviewId && !onCreateReview) || (editingReviewId && !onPatchReview) || busyAction) return;
    setBusyAction(true);
    setErrorText("");
    try {
      if (editingReviewId) {
        await onPatchReview(editingReviewId, { rating, body: reviewBody.trim() });
      } else {
        await onCreateReview({ type: mediaType, id: mediaId, rating, body: reviewBody.trim() });
      }
      setReviewBody("");
      setEditingReviewId("");
      await refreshSocial();
    } catch (e) {
      setErrorText(e?.message || "Publication critique impossible");
    } finally {
      setBusyAction(false);
    }
  }

  function startEditReview(review) {
    setEditingReviewId(String(review.id || ""));
    setRating(Number(review.rating || 5));
    setReviewBody(String(review.body || ""));
  }

  function cancelEditReview() {
    setEditingReviewId("");
    setRating(5);
    setReviewBody("");
  }

  async function removeReview(review) {
    if (!onDeleteReview || busyAction) return;
    setBusyAction(true);
    setErrorText("");
    try {
      await onDeleteReview(review.id);
      if (editingReviewId === String(review.id || "")) cancelEditReview();
      await refreshSocial();
    } catch (e) {
      setErrorText(e?.message || "Suppression critique impossible");
    } finally {
      setBusyAction(false);
    }
  }

  async function likeReview(review) {
    if (!onLikeReview || busyAction) return;
    setBusyAction(true);
    try {
      await onLikeReview(review.id, review.my_vote === "up");
      await refreshSocial();
    } catch (e) {
      setErrorText(e?.message || "Like impossible");
    } finally {
      setBusyAction(false);
    }
  }

  async function addComment(review) {
    if (!onAddComment || !commentText.trim() || busyAction) return;
    setBusyAction(true);
    try {
      await onAddComment(review.id, commentText.trim());
      setCommentText("");
      await refreshSocial();
    } catch (e) {
      setErrorText(e?.message || "Commentaire impossible");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.heading}>Media Detail</Text>
      <Text style={styles.meta}>
        {mediaType} • {mediaId}
      </Text>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color="#77c3ff" /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      {data ? (
        <View style={styles.card}>
          {image ? <Image source={{ uri: image }} style={styles.cover} /> : <View style={styles.coverFallback} />}
          <Text style={styles.name}>{data?.name || "Untitled"}</Text>
          {artists ? <Text style={styles.sub}>{artists}</Text> : null}

          <View style={styles.row}>
            <Badge label={String(data?.type || mediaType)} />
            {typeof data?.popularity === "number" ? <Badge label={`pop ${data.popularity}`} /> : null}
            {data?.album?.release_date ? <Badge label={data.album.release_date} /> : null}
          </View>

          {genres ? <Text style={styles.paragraph}>Genres: {genres}</Text> : null}
          {data?.album?.name ? <Text style={styles.paragraph}>Album: {data.album.name}</Text> : null}
          {data?.degraded ? <Text style={styles.warn}>Donnees limitees temporairement.</Text> : null}
          <View style={styles.playRow}>
            <Pressable
              style={[styles.playBtn, !previewUrl && styles.disabled]}
              onPress={() => openPlaybackUrl(previewUrl, "Preview audio indisponible pour ce media")}
            >
              <Text style={styles.playBtnText}>Preview audio</Text>
            </Pressable>
            <Pressable
              style={[styles.playSecondaryBtn, !spotifyUrl && styles.disabled]}
              onPress={() => openPlaybackUrl(spotifyUrl, "Lien Spotify indisponible")}
            >
              <Text style={styles.playBtnText}>Ouvrir Spotify</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bibliotheque</Text>
        <View style={styles.row}>
          <Pressable style={styles.statusBtn} onPress={() => addStatus("a_voir")}>
            <Text style={styles.statusText}>A ecouter</Text>
          </Pressable>
          <Pressable style={styles.statusBtn} onPress={() => addStatus("en_cours")}>
            <Text style={styles.statusText}>En cours</Text>
          </Pressable>
          <Pressable style={styles.statusBtn} onPress={() => addStatus("termine")}>
            <Text style={styles.statusText}>Termine</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Critiques</Text>
        <Text style={styles.socialMeta}>
          {summary.review_count || 0} avis - moyenne {summary.avg_rating || 0}/5 - {summary.comment_count || 0} commentaire(s)
        </Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} style={[styles.star, rating >= value && styles.starActive]} onPress={() => setRating(value)}>
              <Text style={styles.starText}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={reviewBody}
          onChangeText={setReviewBody}
          multiline
          placeholder={editingReviewId ? "Modifie ton avis" : "Ecris ton avis"}
          placeholderTextColor="#6c7a96"
        />
        {editingReviewId ? (
          <Pressable style={styles.cancelBtn} onPress={cancelEditReview}>
            <Text style={styles.statusText}>Annuler la modification</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.refresh, busyAction && { opacity: 0.6 }]} onPress={submitReview}>
          <Text style={styles.refreshText}>{busyAction ? "Action..." : editingReviewId ? "Enregistrer la critique" : "Publier la critique"}</Text>
        </Pressable>

        {(social?.reviews || []).map((review) => {
          const isOwnReview = String(review.user_id || "") === String(social?.current_user_id || "");
          return (
            <View key={review.id} style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>{review.display_name || "Utilisateur"} - {review.rating}/5</Text>
              {review.body ? <Text style={styles.paragraph}>{review.body}</Text> : null}
              <View style={styles.row}>
                <Pressable style={styles.statusBtn} onPress={() => likeReview(review)}>
                  <Text style={styles.statusText}>{review.my_vote === "up" ? "Aime" : "J'aime"} ({review.likes_count || 0})</Text>
                </Pressable>
                <Text style={styles.socialMeta}>{review.comments?.length || 0} commentaire(s)</Text>
              </View>
              {isOwnReview ? (
                <View style={styles.row}>
                  <Pressable style={styles.statusBtn} onPress={() => startEditReview(review)}>
                    <Text style={styles.statusText}>Modifier</Text>
                  </Pressable>
                  <Pressable style={styles.dangerBtn} onPress={() => removeReview(review)}>
                    <Text style={styles.statusText}>Supprimer</Text>
                  </Pressable>
                </View>
              ) : null}
              {(review.comments || []).slice(0, 2).map((comment) => (
                <Text key={comment.id} style={styles.comment}>- {comment.display_name || "Utilisateur"}: {comment.body}</Text>
              ))}
              <TextInput
                style={styles.input}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Ajouter un commentaire"
                placeholderTextColor="#6c7a96"
              />
              <Pressable style={styles.commentBtn} onPress={() => addComment(review)}>
                <Text style={styles.statusText}>Commenter</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Pressable style={styles.refresh} onPress={() => onLoad({ type: mediaType, id: mediaId }).then(setData).catch((e) => setErrorText(e?.message || "Refresh failed"))}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

function Badge({ label }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914", padding: 16 },
  heading: { color: "#f3f6ff", fontSize: 22, fontWeight: "900" },
  meta: { color: "#8ea2ca", marginTop: 4, marginBottom: 12 },
  error: { color: "#ff9aa9", marginTop: 10 },
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#25344f",
    borderRadius: 12,
    backgroundColor: "#0b1322",
    padding: 12,
  },
  cover: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#11203a" },
  coverFallback: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#11203a" },
  name: { color: "#eef4ff", fontWeight: "900", fontSize: 19, marginTop: 10 },
  sub: { color: "#97abd2", marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  badge: {
    borderWidth: 1,
    borderColor: "#334666",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: "#a3b8e0", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  paragraph: { color: "#d2def7", marginTop: 10, lineHeight: 20 },
  warn: { color: "#ffd49d", marginTop: 10 },
  playRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  playBtn: { flexGrow: 1, backgroundColor: "#3f83ff", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  playSecondaryBtn: { flexGrow: 1, backgroundColor: "#253756", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  playBtnText: { color: "#fff", fontWeight: "900", textAlign: "center", fontSize: 12 },
  disabled: { opacity: 0.45 },
  refresh: { marginTop: 14, backgroundColor: "#2d5eb8", borderRadius: 10, paddingVertical: 10 },
  refreshText: { textAlign: "center", color: "#fff", fontWeight: "800" },
  sectionTitle: { color: "#eef4ff", fontWeight: "900", fontSize: 18 },
  socialMeta: { color: "#8ea2ca", marginTop: 6, fontSize: 12 },
  statusBtn: { borderWidth: 1, borderColor: "#334666", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  statusText: { color: "#dbe7ff", fontWeight: "800", fontSize: 12 },
  ratingRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  star: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: "#334666", justifyContent: "center", alignItems: "center" },
  starActive: { backgroundColor: "#3f83ff", borderColor: "#77c3ff" },
  starText: { color: "#fff", fontWeight: "900" },
  input: { marginTop: 10, borderWidth: 1, borderColor: "#2a3550", borderRadius: 10, backgroundColor: "#0d1424", color: "#f0f5ff", paddingHorizontal: 12, paddingVertical: 10 },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  reviewCard: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#1e2a42", paddingTop: 12 },
  reviewTitle: { color: "#eff4ff", fontWeight: "900" },
  comment: { color: "#b9c7e4", marginTop: 6, fontSize: 12 },
  commentBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#334666", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
  cancelBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#334666", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  dangerBtn: { borderWidth: 1, borderColor: "#8f3342", backgroundColor: "#35101a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
});
