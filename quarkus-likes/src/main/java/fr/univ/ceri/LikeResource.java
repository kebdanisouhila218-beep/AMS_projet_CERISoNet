package fr.univ.ceri;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.bson.types.ObjectId;
import java.util.ArrayList;
import java.util.List;

@Path("/likes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class LikeResource {

    @Inject
    MongoClient mongoClient;

    private MongoCollection<Document> getCollection() {
        MongoDatabase db = mongoClient.getDatabase("db-CERI");
        return db.getCollection("CERISoNet");
    }

    @GET
public List<Document> getAll() {
    List<Document> list = new ArrayList<>();
    for (Document doc : getCollection().find()) {
        doc.put("id", doc.get("_id").toString());
        list.add(doc);
    }
    return list;
}

    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") String id) {
        try {
            Document doc = getCollection().find(new Document("_id", new ObjectId(id))).first();
            if (doc == null)
                return Response.status(404).entity("{\"message\":\"Post non trouvé\"}").build();
            doc.put("id", doc.getObjectId("_id").toString());
            return Response.ok(doc.toJson()).build();
        } catch (Exception e) {
            return Response.status(400).entity("{\"message\":\"ID invalide\"}").build();
        }
    }

    @POST
    @Path("/{id}")
    public Response addLike(@PathParam("id") String id, LikeRequest req) {
        try {
            Document doc = getCollection().find(new Document("_id", new ObjectId(id))).first();
            if (doc == null)
                return Response.status(404).entity("{\"message\":\"Post non trouvé\"}").build();
            List<Integer> likedBy = (List<Integer>) doc.get("likedBy");
            if (likedBy == null) likedBy = new ArrayList<>();
            if (likedBy.contains(req.userId))
                return Response.status(409).entity("{\"message\":\"Déjà liké\"}").build();
            likedBy.add(req.userId);
            getCollection().updateOne(
                new Document("_id", new ObjectId(id)),
                new Document("$set", new Document("likedBy", likedBy))
            );
            return Response.ok("{\"message\":\"Like ajouté\"}").build();
        } catch (Exception e) {
            return Response.status(400).entity("{\"message\":\"" + e.getMessage() + "\"}").build();
        }
    }

    @PUT
    @Path("/{id}")
    public Response updateLikes(@PathParam("id") String id, LikeRequest req) {
        try {
            Document doc = getCollection().find(new Document("_id", new ObjectId(id))).first();
            if (doc == null)
                return Response.status(404).entity("{\"message\":\"Post non trouvé\"}").build();
            getCollection().updateOne(
                new Document("_id", new ObjectId(id)),
                new Document("$set", new Document("likes", req.likes))
            );
            return Response.ok("{\"message\":\"Likes mis à jour\"}").build();
        } catch (Exception e) {
            return Response.status(400).entity("{\"message\":\"" + e.getMessage() + "\"}").build();
        }
    }

    @DELETE
    @Path("/{id}")
    public Response removeLike(@PathParam("id") String id, LikeRequest req) {
        try {
            Document doc = getCollection().find(new Document("_id", new ObjectId(id))).first();
            if (doc == null)
                return Response.status(404).entity("{\"message\":\"Post non trouvé\"}").build();
            List<Integer> likedBy = (List<Integer>) doc.get("likedBy");
            if (likedBy != null) {
                likedBy.remove(Integer.valueOf(req.userId));
                getCollection().updateOne(
                    new Document("_id", new ObjectId(id)),
                    new Document("$set", new Document("likedBy", likedBy))
                );
            }
            return Response.ok("{\"message\":\"Like retiré\"}").build();
        } catch (Exception e) {
            return Response.status(400).entity("{\"message\":\"" + e.getMessage() + "\"}").build();
        }
    }
}