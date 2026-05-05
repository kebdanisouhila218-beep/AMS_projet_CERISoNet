package fr.univ.ceri;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.Document;

@MongoEntity(collection = "CERISoNet")
public class Like extends PanacheMongoEntity {
    public String body;
    public Object likes;
    public Object createdBy;
    public Object likedBy;
}