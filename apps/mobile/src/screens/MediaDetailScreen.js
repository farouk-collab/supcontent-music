import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const STATUSES = [
  { key: "a_voir", label: "À écouter" },
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "abandonne", label: "Abandonné" },
];

function pickImage(item) {
  const fromItem = Array.isArray(item?.images) ? item.images : [];
  const fromAlbum = Array.isArray(item?.album?.images) ? item.album.images : [];
  const first = [...fromItem, ...fromAlbum][0];
  return first?.url || "";
}

function Stars({ value, onSelect, size = 22 }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onSelect && onSelect(n)}>
          <Text style={{ fontSize: size, color: n <= value ? "#f5c842" : "#334466" }}>
            {n <= value ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ReviewCard({ review, currentUserId, onVote, onDelete, onCreateComment, onDeleteComment, onVoteComment }) {
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isOwn = review.user_id === currentUserId;
  const comments = Array.isArray(review.comments) ? review.comments : [];

  async function submitComment() {
    if (!commentText.trim() || !onCreateComment) return;
    setSubmitting(true);
    try {
      await onCreateComment(review.id, commentText.trim());
      setCommentText("");
      setShowCommentForm(false);
    } catch {}
    setSubmitting(false);
  }

  return (
    <View style={s.reviewCard}>
      <View style={s.reviewHeader}>
        <Text style={s.reviewAuthor}>{review.display_name || "Utilisateur"}</Text>
        <Stars value={review.rating} size={14} />
      </View>
      {review.body ? <Text style={s.reviewBody}>{review.body}</Text> : null}
      <View style={s.reviewFooter}>
        <Pressable style={s.voteBtn} onPress={() => onVote(review.id, "up")}>
          <Text style={s.voteBtnText}>👍 {review.likes_count || 0}</Text>
        </Pressable>
        <Pressable style={s.voteBtn} onPress={() => onVote(review.id, "down")}>
          <Text style={s.voteBtnText}>👎 {review.dislikes_count || 0}</Text>
        </Pressable>
        {currentUserId && (
          <Pressable style={s.voteBtn} onPress={() => setShowCommentForm((v) => !v)}>
            <Text style={s.voteBtnText}>💬 {comments.length}</Text>
          </Pressable>
        )}
        {isOwn && (
          <Pressable style={[s.voteBtn, s.deleteBtnStyle]} onPress={() => onDelete(review.id)}>
            <Text style={s.voteBtnText}>Suppr.</Text>
          </Pressable>
        )}
      </View>

      {comments.length > 0 && (
        <View style={s.commentsBlock}>
          {comments.map((c) => (
            <View key={c.id} style={s.commentItem}>
              <View style={s.commentHeader}>
                <Text style={s.commentAuthor}>{c.display_name || "Utilisateur"}</Text>
                {c.user_id === currentUserId && onDeleteComment ? (
                  <Pressable onPress={() => onDeleteComment(c.id)}>
                    <Text style={s.commentDelete}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={s.commentBody}>{c.body || c.content}</Text>
              <View style={s.commentFooter}>
                <Pressable onPress={() => onVoteComment && onVoteComment(c.id, "up")}>
                  <Text style={s.commentVote}>👍 {c.likes_count || 0}</Text>
                </Pressable>
                <Pressable onPress={() => onVoteComment && onVoteComment(c.id, "down")}>
                  <Text style={s.commentVote}>👎 {c.dislikes_count || 0}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {showCommentForm && (
        <View style={s.commentForm}>
          <TextInput
            style={s.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Votre commentaire..."
            placeholderTextColor="#546a8f"
            multiline
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable style={[s.voteBtn, { flex: 1 }]} onPress={() => setShowCommentForm(false)}>
              <Text style={[s.voteBtnText, { textAlign: "center" }]}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[s.voteBtn, { flex: 1, backgroundColor: "#3f83ff", borderColor: "#3f83ff" }, (!commentText.trim() || submitting) && { opacity: 0.5 }]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              <Text style={[s.voteBtnText, { textAlign: "center" }]}>{submitting ? "..." : "Envoyer"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export function MediaDetailScreen({ mediaType, mediaId, onLoad, onLoadReviews, onCreateReview, onDeleteReview, onVoteReview, onCreateReviewComment, onDeleteComment, onVoteComment, onAddToStatus, session }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // My review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myBody, setMyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Add to collection modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAdding, setStatusAdding] = useState(null);
  const [statusSuccess, setStatusSuccess] = useState("");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await onLoad({ type: mediaType, id: mediaId });
      setData(next);
    } catch (e) {
      setError(e?.message || "Impossible de charger");
    } finally {
      setLoading(false);
    }
  }, [mediaId, mediaType, onLoad]);

  const loadReviews = useCallback(async () => {
    if (!onLoadReviews) return;
    setReviewsLoading(true);
    try {
      const result = await onLoadReviews(mediaType, mediaId);
      setReviews(Array.isArray(result?.reviews) ? result.reviews : []);
      setStats(result?.stats || null);
    } catch {
      // silently fail reviews
    } finally {
      setReviewsLoading(false);
    }
  }, [mediaType, mediaId, onLoadReviews]);

  useEffect(() => {
    loadMedia();
    loadReviews();
  }, [loadMedia, loadReviews]);

  async function submitReview() {
    if (myRating === 0 || !onCreateReview) return;
    setSubmitting(true);
    try {
      await onCreateReview(mediaType, mediaId, myRating, myBody);
      setShowReviewForm(false);
      setMyRating(0);
      setMyBody("");
      await loadReviews();
    } catch (e) {
      setError(e?.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(reviewId, vote) {
    if (!onVoteReview) return;
    try {
      await onVoteReview(reviewId, vote);
      await loadReviews();
    } catch {}
  }

  async function handleDelete(reviewId) {
    if (!onDeleteReview) return;
    try {
      await onDeleteReview(reviewId);
      await loadReviews();
    } catch (e) {
      setError(e?.message || "Erreur suppression");
    }
  }

  async function handleAddToStatus(status) {
    if (!onAddToStatus) return;
    setStatusAdding(status);
    try {
      await onAddToStatus(status, mediaType, mediaId);
      setStatusSuccess(`Ajouté à "${STATUSES.find((s) => s.key === status)?.label}"`);
      setTimeout(() => { setStatusSuccess(""); setShowStatusModal(false); }, 1500);
    } catch (e) {
      setError(e?.message || "Erreur ajout collection");
    } finally {
      setStatusAdding(null);
    }
  }

  const image = pickImage(data);
  const artists = Array.isArray(data?.artists) ? data.artists.map((a) => a?.name).filter(Boolean).join(", ") : "";
  const genres = Array.isArray(data?.genres) ? data.genres.filter(Boolean).join(", ") : "";

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 120 }}>
      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color="#77c3ff" /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {data ? (
        <>
          {image ? <Image source={{ uri: image }} style={s.cover} /> : <View style={s.coverFallback} />}

          <View style={s.section}>
            <Text style={s.name}>{data?.name || "Titre inconnu"}</Text>
            {artists ? <Text style={s.sub}>{artists}</Text> : null}

            <View style={s.badgeRow}>
              <View style={s.badge}><Text style={s.badgeText}>{data?.type || mediaType}</Text></View>
              {typeof data?.popularity === "number" ? <View style={s.badge}><Text style={s.badgeText}>Pop. {data.popularity}</Text></View> : null}
              {data?.album?.release_date ? <View style={s.badge}><Text style={s.badgeText}>{data.album.release_date}</Text></View> : null}
            </View>

            {genres ? <Text style={s.meta}>Genres : {genres}</Text> : null}
            {data?.album?.name ? <Text style={s.meta}>Album : {data.album.name}</Text> : null}

            {stats ? (
              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <Text style={s.statNum}>{Number(stats.avg_rating || 0).toFixed(1)}</Text>
                  <Text style={s.statLabel}>Note moy.</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statNum}>{stats.review_count || 0}</Text>
                  <Text style={s.statLabel}>Critiques</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statNum}>{stats.like_count || 0}</Text>
                  <Text style={s.statLabel}>Likes</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Actions */}
          <View style={s.actionsRow}>
            <Pressable style={s.actionBtn} onPress={() => setShowStatusModal(true)}>
              <Text style={s.actionBtnText}>+ Collection</Text>
            </Pressable>
            {session && (
              <Pressable style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => setShowReviewForm(true)}>
                <Text style={s.actionBtnText}>Donner un avis</Text>
              </Pressable>
            )}
          </View>
          {data?.external_urls?.spotify ? (
            <Pressable
              style={s.spotifyBtn}
              onPress={() => Linking.openURL(data.external_urls.spotify)}
            >
              <Text style={s.spotifyBtnText}>▶ Ouvrir dans Spotify</Text>
            </Pressable>
          ) : null}

          {statusSuccess ? <Text style={s.success}>{statusSuccess}</Text> : null}

          {/* Reviews */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Critiques ({reviews.length})</Text>
            {reviewsLoading ? <ActivityIndicator color="#77c3ff" /> : null}
            {reviews.length === 0 && !reviewsLoading ? (
              <Text style={s.emptyReviews}>Soyez le premier à donner votre avis.</Text>
            ) : (
              reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  currentUserId={session?.user?.id}
                  onVote={handleVote}
                  onDelete={handleDelete}
                  onCreateComment={onCreateReviewComment ? (reviewId, body) => onCreateReviewComment(reviewId, body).then(loadReviews) : null}
                  onDeleteComment={onDeleteComment ? (commentId) => onDeleteComment(commentId).then(loadReviews) : null}
                  onVoteComment={onVoteComment ? (commentId, vote) => onVoteComment(commentId, vote).then(loadReviews) : null}
                />
              ))
            )}
          </View>
        </>
      ) : null}

      {/* Review form modal */}
      <Modal visible={showReviewForm} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Votre critique</Text>
            <Text style={s.modalLabel}>Note</Text>
            <Stars value={myRating} onSelect={setMyRating} size={30} />
            <Text style={[s.modalLabel, { marginTop: 14 }]}>Commentaire (optionnel)</Text>
            <TextInput
              style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
              multiline
              value={myBody}
              onChangeText={setMyBody}
              placeholder="Partagez votre expérience..."
              placeholderTextColor="#6c7a96"
            />
            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setShowReviewForm(false)}>
                <Text style={s.modalBtnText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirm, (myRating === 0 || submitting) && { opacity: 0.5 }]}
                onPress={submitReview}
                disabled={myRating === 0 || submitting}
              >
                <Text style={s.modalBtnText}>{submitting ? "Envoi..." : "Publier"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Ajouter à ma bibliothèque</Text>
            {STATUSES.map((st) => (
              <Pressable
                key={st.key}
                style={[s.statusBtn, statusAdding === st.key && { opacity: 0.5 }]}
                onPress={() => handleAddToStatus(st.key)}
                disabled={statusAdding !== null}
              >
                <Text style={s.statusBtnText}>{st.label}</Text>
              </Pressable>
            ))}
            <Pressable style={[s.modalCancel, { marginTop: 10 }]} onPress={() => setShowStatusModal(false)}>
              <Text style={s.modalBtnText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914" },
  error: { color: "#ff9aa9", margin: 16 },
  success: { color: "#9ff0c1", marginHorizontal: 16, marginBottom: 8, fontWeight: "700" },
  cover: { width: "100%", height: 240, backgroundColor: "#11203a" },
  coverFallback: { width: "100%", height: 240, backgroundColor: "#11203a" },
  section: { padding: 16 },
  name: { color: "#eef4ff", fontWeight: "900", fontSize: 20, marginTop: 4 },
  sub: { color: "#97abd2", marginTop: 4, fontSize: 14 },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  badge: { borderWidth: 1, borderColor: "#334666", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: "#a3b8e0", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  meta: { color: "#c0d4f5", marginTop: 8, fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  statBox: { flex: 1, backgroundColor: "#0d1e36", borderRadius: 10, padding: 10, alignItems: "center" },
  statNum: { color: "#77c3ff", fontWeight: "900", fontSize: 20 },
  statLabel: { color: "#7a95c5", fontSize: 11, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  spotifyBtn: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: "#1DB954",
    borderRadius: 10,
    paddingVertical: 11,
  },
  spotifyBtnText: { textAlign: "center", color: "#fff", fontWeight: "800", fontSize: 14 },
  actionBtn: { flex: 1, backgroundColor: "#1e3356", borderRadius: 10, paddingVertical: 11, borderWidth: 1, borderColor: "#2a4470" },
  actionBtnPrimary: { backgroundColor: "#3f83ff", borderColor: "#3f83ff" },
  actionBtnText: { textAlign: "center", color: "#fff", fontWeight: "800" },
  sectionTitle: { color: "#7a95c5", fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  emptyReviews: { color: "#546a8f", textAlign: "center", marginTop: 10 },
  reviewCard: { backgroundColor: "#0b1322", borderWidth: 1, borderColor: "#263550", borderRadius: 12, padding: 12, marginTop: 8 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  reviewAuthor: { color: "#d0e4ff", fontWeight: "800" },
  reviewBody: { color: "#a8c0e8", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  reviewFooter: { flexDirection: "row", gap: 8 },
  voteBtn: { borderWidth: 1, borderColor: "#2e4060", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnStyle: { borderColor: "#5c2030", backgroundColor: "#1a0810" },
  voteBtnText: { color: "#c0d4f5", fontSize: 12, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#2a3550", borderRadius: 10, backgroundColor: "#0d1424", color: "#f0f5ff", paddingHorizontal: 12, paddingVertical: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#0e1b30", borderRadius: 16, padding: 20, width: "85%", borderWidth: 1, borderColor: "#2a3f60" },
  modalTitle: { color: "#f0f6ff", fontWeight: "900", fontSize: 18, marginBottom: 14 },
  modalLabel: { color: "#9eb2db", fontWeight: "600", marginBottom: 8 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, backgroundColor: "#1e2f4a", borderRadius: 10, paddingVertical: 11 },
  modalConfirm: { flex: 1, backgroundColor: "#3f83ff", borderRadius: 10, paddingVertical: 11 },
  modalBtnText: { textAlign: "center", color: "#fff", fontWeight: "800" },
  statusBtn: { backgroundColor: "#132035", borderWidth: 1, borderColor: "#2a4470", borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  statusBtnText: { textAlign: "center", color: "#c8deff", fontWeight: "700" },
  commentsBlock: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#1a2a45", paddingTop: 8 },
  commentItem: { marginBottom: 6, backgroundColor: "#060e1d", borderRadius: 8, padding: 8 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  commentAuthor: { color: "#7a9fd4", fontWeight: "800", fontSize: 12 },
  commentDelete: { color: "#6b2535", fontSize: 12, paddingHorizontal: 6, paddingVertical: 2 },
  commentBody: { color: "#8ea8d0", fontSize: 13, lineHeight: 17 },
  commentFooter: { flexDirection: "row", gap: 12, marginTop: 5 },
  commentVote: { color: "#546a8f", fontSize: 11 },
  commentForm: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#1a2a45", paddingTop: 8 },
  commentInput: { borderWidth: 1, borderColor: "#2a3550", borderRadius: 8, backgroundColor: "#0a1020", color: "#f0f5ff", paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
});
